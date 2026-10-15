/**
 * Discovery runs: durable, resumable, idempotent.
 *
 * - A run is planned once into `job_tasks` (unique key per run → re-planning never duplicates).
 * - Tasks are claimed with a lease (`FOR UPDATE SKIP LOCKED`), retried with exponential backoff up to
 *   `max_attempts`, and an expired lease (crash, timeout) makes a task claimable again.
 * - Work is processed in slices bounded by a deadline; whatever is left is resumed by the next tick.
 * - Paid operations stop at the spending limits (task "skipped: budget"); free work continues.
 * - Final status is honest: failed / partial / budget_exhausted / succeeded — never "success, 0 results"
 *   when searches failed.
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { aiConfigured } from "../ai/client.ts";
import { db } from "../db/client.ts";
import { companies, contacts, jobRuns, jobTasks, type RunStats } from "../db/schema.ts";
import { discoverCompanies } from "../discovery/company-discovery.ts";
import { enrichCompany, enrichPerson } from "../discovery/enrich.ts";
import { PoliteFetcher } from "../discovery/fetcher.ts";
import { researchCompany } from "../discovery/research-company.ts";
import { recheckEmployment, verifyEmail } from "../discovery/verify.ts";
import { logEvent } from "../events.ts";
import { contactSource } from "../providers/index.ts";
import { ProviderError, RateLimitedError } from "../providers/types.ts";
import { backfillRoleFunctions, refreshAllDerived } from "../services/contacts.ts";
import { getSettings } from "../settings.ts";
import { BudgetExceededError } from "./budget.ts";

export type RunRow = typeof jobRuns.$inferSelect;
export type TaskRow = typeof jobTasks.$inferSelect;
type TaskKind =
  | "find_companies"
  | "research_company"
  | "enrich_company"
  | "enrich_person"
  | "verify_email"
  | "recheck_employment"
  | "maintenance";

const TASK_LEASE_MS = 6 * 60_000;
const TASK_PRIORITY: Record<TaskKind, number> = {
  maintenance: 0,
  find_companies: 1,
  research_company: 2,
  verify_email: 3,
  enrich_company: 4,
  enrich_person: 5,
  recheck_employment: 6,
};

// ---------------------------------------------------------------------------
// Creating runs
// ---------------------------------------------------------------------------

export async function activeRun(kind = "discovery"): Promise<RunRow | null> {
  const [r] = await db()
    .select()
    .from(jobRuns)
    .where(and(eq(jobRuns.kind, kind), inArray(jobRuns.status, ["queued", "running"])))
    .orderBy(asc(jobRuns.createdAt))
    .limit(1);
  return r ?? null;
}

/** Idempotent for scheduled runs: the unique (kind, local_date) index allows one per local day. */
export async function createScheduledRun(
  localDate: string,
  trigger: "schedule" | "catch_up",
): Promise<RunRow | null> {
  const [r] = await db()
    .insert(jobRuns)
    .values({ kind: "discovery", trigger, localDate, status: "queued" })
    .onConflictDoNothing()
    .returning();
  return r ?? null;
}

/** Manual "Run now": reuses an active run instead of starting an overlapping equivalent one. */
export async function createManualRun(): Promise<{ run: RunRow; reused: boolean }> {
  const existing = await activeRun();
  if (existing) return { run: existing, reused: true };
  const [r] = await db()
    .insert(jobRuns)
    .values({ kind: "discovery", trigger: "manual", status: "queued" })
    .returning();
  return { run: r!, reused: false };
}

export async function cancelRun(runId: string): Promise<void> {
  await db()
    .update(jobTasks)
    .set({ status: "skipped", error: "Anulowano" })
    .where(and(eq(jobTasks.runId, runId), eq(jobTasks.status, "pending")));
  await db()
    .update(jobRuns)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(and(eq(jobRuns.id, runId), inArray(jobRuns.status, ["queued", "running"])));
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

async function addTask(
  runId: string,
  kind: TaskKind,
  key: string,
  targetId: string | null,
  payload: Record<string, unknown> = {},
  maxAttempts = 3,
) {
  await db()
    .insert(jobTasks)
    .values({ runId, kind, key, targetId, payload, maxAttempts })
    .onConflictDoNothing();
}

/** Allocates the run's budget across the four kinds of work. Daily targets are caps, not quotas. */
export async function planRun(run: RunRow): Promise<Record<string, unknown>> {
  const s = await getSettings("discovery");
  const fr = await getSettings("freshness");
  const now = new Date();
  const providerOn = Boolean(contactSource());

  await addTask(run.id, "maintenance", "maintenance", null, {}, 2);

  // 1. New companies beyond the initial universe.
  if (s.maxNewCompaniesPerRun > 0)
    await addTask(run.id, "find_companies", "find_companies", null, { max: s.maxNewCompaniesPerRun }, 2);

  // 2. Companies without suitable contacts: never researched first (initial universe, then discovered),
  //    then those whose revisit date has come. Excluded companies are never selected.
  const sizeOk = sql`(
    ${s.includeUnknownSize} or coalesce((${companies.employeesPoland}->>'value')::int, (${companies.employeesGlobal}->>'value')::int, 0) >= ${s.minEmployees}
  )`;
  const regionOk = s.regions.length
    ? sql`exists (select 1 from jsonb_array_elements_text(${companies.locations}) l where lower(l) in ${s.regions.map((r) => r.toLowerCase())})`
    : sql`true`;
  const due = await db()
    .select({ id: companies.id, status: companies.researchStatus })
    .from(companies)
    .where(
      and(
        eq(companies.excluded, false),
        eq(companies.isDemo, false),
        sql`${companies.sector}::text in ${s.sectors.length ? s.sectors : ["-"]}`,
        sql`${companies.domain} not in ${s.excludedDomains.length ? s.excludedDomains : ["-"]}`,
        sizeOk,
        regionOk,
        or(
          eq(companies.researchStatus, "queued"),
          and(
            eq(companies.researchStatus, "needs_more_work"),
            or(isNull(companies.nextResearchAt), lte(companies.nextResearchAt, now)),
          ),
        ),
      ),
    )
    .orderBy(
      sql`case ${companies.researchStatus} when 'queued' then 0 else 1 end`,
      sql`case ${companies.origin} when 'initial_universe' then 0 when 'manual' then 1 else 2 end`,
      sql`jsonb_array_length(${companies.prioritySignals}) desc`,
      asc(companies.nextResearchAt),
      asc(companies.name),
    )
    .limit(s.maxCompaniesResearchedPerRun);
  for (const c of due) await addTask(run.id, "research_company", `research:${c.id}`, c.id);

  // 3. Enrichment of incomplete records (paid; only when a provider is configured).
  let enrichPlanned = 0;
  if (providerOn && s.maxEnrichmentsPerRun > 0) {
    const people = await db()
      .select({ id: contacts.id })
      .from(contacts)
      .innerJoin(companies, eq(contacts.companyId, companies.id))
      .where(
        and(
          eq(contacts.kind, "person"),
          isNull(contacts.emailNormalized),
          inArray(contacts.roleCategory, ["decision_maker", "organizer_influencer"]),
          inArray(contacts.reviewStatus, ["new", "accepted"]),
          eq(companies.excluded, false),
          sql`not exists (select 1 from contact_events e where e.contact_id = ${contacts.id} and e.type = 'enrich_attempted' and e.created_at > now() - make_interval(days => ${fr.revisitNeedsEnrichmentDays}))`,
        ),
      )
      .limit(s.maxEnrichmentsPerRun);
    for (const p of people) await addTask(run.id, "enrich_person", `enrich_person:${p.id}`, p.id);
    enrichPlanned += people.length;
    const left = s.maxEnrichmentsPerRun - people.length;
    if (left > 0) {
      const cos = await db()
        .select({ id: companies.id })
        .from(companies)
        .where(
          and(
            eq(companies.excluded, false),
            inArray(companies.researchOutcome, [
              "no_suitable_contact",
              "general_contact_only",
              "department_found_no_named_contact",
              "needs_provider_enrichment",
            ]),
            sql`not exists (select 1 from provider_usage u where u.detail = ${companies.domain} and u.operation = 'domain-search' and u.created_at > now() - make_interval(days => ${fr.revisitNoContactDays}))`,
          ),
        )
        .orderBy(sql`jsonb_array_length(${companies.prioritySignals}) desc`, asc(companies.lastResearchedAt))
        .limit(left);
      for (const c of cos) await addTask(run.id, "enrich_company", `enrich_company:${c.id}`, c.id);
      enrichPlanned += cos.length;
    }
  }

  // 4. Rechecks: unverified or stale emails, then employment of named people. Unchanged records are not
  //    re-paid within the revisit window.
  const verifyRows = await db()
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        isNotNull(contacts.emailNormalized),
        inArray(contacts.reviewStatus, ["new", "accepted"]),
        sql`${contacts.quality} <> 'blocked'`,
        sql`${contacts.kind} <> 'general_inbox'`,
        or(
          eq(contacts.emailStatus, "not_checked"),
          eq(contacts.emailStatus, "expired"),
          sql`${contacts.emailCheckedAt} < now() - make_interval(days => ${fr.emailReverifyDays})`,
        ),
        sql`not exists (select 1 from contact_verifications v where v.contact_id = ${contacts.id} and v.checked_at > now() - interval '7 days')`,
      ),
    )
    .orderBy(sql`case ${contacts.reviewStatus} when 'accepted' then 0 else 1 end`, asc(contacts.discoveredAt))
    .limit(s.maxRechecksPerRun);
  for (const c of verifyRows) await addTask(run.id, "verify_email", `verify:${c.id}`, c.id);
  const empRows = await db()
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.kind, "person"),
        inArray(contacts.reviewStatus, ["new", "accepted"]),
        sql`${contacts.employmentStatus} <> 'left'`,
        or(
          isNull(contacts.employmentCheckedAt),
          sql`${contacts.employmentCheckedAt} < now() - make_interval(days => ${fr.employmentRecheckDays})`,
        ),
        sql`exists (select 1 from contact_evidence e where e.contact_id = ${contacts.id} and e.kind = 'source_page')`,
      ),
    )
    .limit(Math.max(0, s.maxRechecksPerRun - verifyRows.length));
  for (const c of empRows) await addTask(run.id, "recheck_employment", `employment:${c.id}`, c.id);

  const plan = {
    plannedAt: now.toISOString(),
    findCompanies: s.maxNewCompaniesPerRun,
    research: due.length,
    enrich: enrichPlanned,
    verify: verifyRows.length,
    employment: empRows.length,
    providerConfigured: providerOn,
    aiConfigured: aiConfigured(),
  };
  await db().update(jobRuns).set({ plan }).where(eq(jobRuns.id, run.id));
  return plan;
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

async function claimTask(runId: string, budgetStopped: boolean): Promise<TaskRow | null> {
  const paidKinds = ["enrich_company", "enrich_person"];
  const res = await db().execute<TaskRow & Record<string, unknown>>(sql`
    update job_tasks set status = 'running', attempts = attempts + 1, lease_until = now() + ${`${TASK_LEASE_MS} milliseconds`}::interval,
      started_at = coalesce(started_at, now())
    where id = (
      select id from job_tasks
      where run_id = ${runId}
        and (status = 'pending' or (status = 'running' and lease_until < now()))
        and (next_attempt_at is null or next_attempt_at <= now())
        and attempts < max_attempts
        ${budgetStopped ? sql`and kind not in ${paidKinds}` : sql``}
      order by case kind ${sql.raw(
        Object.entries(TASK_PRIORITY)
          .map(([k, v]) => `when '${k}' then ${v}`)
          .join(" "),
      )} else 9 end, created_at
      limit 1
      for update skip locked
    )
    returning id, run_id as "runId", kind, key, target_id as "targetId", payload, status, attempts, max_attempts as "maxAttempts"
  `);
  const row = (res as unknown as TaskRow[])[0];
  return row ?? null;
}

async function finishTask(
  id: string,
  status: "done" | "failed" | "skipped" | "pending",
  fields: { result?: Record<string, unknown>; error?: string | null; nextAttemptAt?: Date | null },
) {
  await db()
    .update(jobTasks)
    .set({
      status,
      result: fields.result ?? null,
      error: fields.error ?? null,
      nextAttemptAt: fields.nextAttemptAt ?? null,
      leaseUntil: null,
      finishedAt: status === "pending" ? null : new Date(),
    })
    .where(eq(jobTasks.id, id));
}

type Ctx = { run: RunRow; fetcher: PoliteFetcher; deadline: number };

async function execute(task: TaskRow, ctx: Ctx): Promise<Record<string, unknown>> {
  const s = await getSettings("discovery");
  switch (task.kind as TaskKind) {
    case "maintenance": {
      const functionsFilled = await backfillRoleFunctions();
      const n = await refreshAllDerived();
      return { contactsRefreshed: n, functionsFilled };
    }
    case "find_companies": {
      const r = await discoverCompanies({
        max: Number(task.payload.max ?? s.maxNewCompaniesPerRun),
        minEmployees: s.minEmployees,
        sectors: s.sectors,
        excludedDomains: s.excludedDomains,
      });
      // Newly found companies are researched in the same run when the run still has room.
      const existing = await db()
        .select({ n: sql<number>`count(*)::int` })
        .from(jobTasks)
        .where(and(eq(jobTasks.runId, ctx.run.id), eq(jobTasks.kind, "research_company")));
      let room = Math.max(0, s.maxCompaniesResearchedPerRun - (existing[0]?.n ?? 0));
      for (const id of r.added) {
        if (room-- <= 0) break;
        await addTask(ctx.run.id, "research_company", `research:${id}`, id);
      }
      return {
        companiesDiscovered: r.added.length,
        considered: r.considered,
        alreadyKnown: r.skippedKnown,
        source: r.source,
      };
    }
    case "research_company": {
      const r = await researchCompany(task.targetId!, {
        fetcher: ctx.fetcher,
        runId: ctx.run.id,
        deadline: Math.min(ctx.deadline, Date.now() + 5 * 60_000),
        maxPages: s.maxPagesPerCompany,
        maxContacts: s.maxContactsPerCompany,
      });
      // Free DNS sanity check of newly found addresses (paid verification is a separate, budgeted task).
      for (const id of r.newContactIds) {
        const [c] = await db()
          .select({ e: contacts.emailNormalized })
          .from(contacts)
          .where(eq(contacts.id, id))
          .limit(1);
        if (c?.e) await addTask(ctx.run.id, "verify_email", `verify:${id}`, id);
      }
      if (r.unavailable)
        throw new SourceUnavailable(r.note ?? "strona niedostępna", r as unknown as Record<string, unknown>);
      return r as unknown as Record<string, unknown>;
    }
    case "enrich_company": {
      const r = await enrichCompany(task.targetId!, {
        runId: ctx.run.id,
        taskId: task.id,
        maxContacts: s.maxContactsPerCompany,
      });
      return r as unknown as Record<string, unknown>;
    }
    case "enrich_person": {
      await db().execute(
        sql`insert into contact_events (contact_id, type, data) values (${task.targetId}, 'enrich_attempted', '{}'::jsonb)`,
      );
      const r = await enrichPerson(task.targetId!, { runId: ctx.run.id, taskId: task.id });
      return r as unknown as Record<string, unknown>;
    }
    case "verify_email": {
      const r = await verifyEmail(task.targetId!, { runId: ctx.run.id, taskId: task.id });
      return r as unknown as Record<string, unknown>;
    }
    case "recheck_employment": {
      const r = await recheckEmployment(task.targetId!, ctx.fetcher);
      return r as unknown as Record<string, unknown>;
    }
  }
  return {};
}

class SourceUnavailable extends Error {
  constructor(
    message: string,
    public result: Record<string, unknown>,
  ) {
    super(message);
  }
}

export type SliceResult = {
  runId: string;
  processed: number;
  remaining: number;
  finished: boolean;
  status: RunRow["status"];
};

/** Process tasks of one run until the deadline. Safe to call concurrently (task leases) and repeatedly. */
export async function processRun(runId: string, deadline: number, holder: string): Promise<SliceResult> {
  let [run] = await db().select().from(jobRuns).where(eq(jobRuns.id, runId)).limit(1);
  if (!run) throw new Error("run not found");
  if (run.status === "queued") {
    await db()
      .update(jobRuns)
      .set({ status: "running", startedAt: new Date(), leaseOwner: holder, heartbeatAt: new Date() })
      .where(eq(jobRuns.id, runId));
    try {
      await planRun(run);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db()
        .update(jobRuns)
        .set({ status: "failed", error: `Planowanie nie powiodło się: ${msg}`, finishedAt: new Date() })
        .where(eq(jobRuns.id, runId));
      await logEvent(
        "error",
        "discovery",
        "Planowanie przebiegu nie powiodło się",
        { message: msg.slice(0, 300) },
        runId,
      );
      return { runId, processed: 0, remaining: 0, finished: true, status: "failed" };
    }
    [run] = await db().select().from(jobRuns).where(eq(jobRuns.id, runId)).limit(1);
  }
  if (run?.status !== "running")
    return { runId, processed: 0, remaining: 0, finished: true, status: run?.status ?? "failed" };

  // Tasks that crashed on their last allowed attempt are closed as failed (otherwise the run could never finish).
  await db().execute(sql`
    update job_tasks set status = 'failed', error = coalesce(error, 'Przerwane: wyczerpano liczbę prób'), finished_at = now(), lease_until = null
    where run_id = ${runId} and status = 'running' and lease_until < now() and attempts >= max_attempts`);
  await db().execute(sql`
    update job_tasks set status = 'failed', error = coalesce(error, 'Wyczerpano liczbę prób'), finished_at = now()
    where run_id = ${runId} and status = 'pending' and attempts >= max_attempts`);
  const s = await getSettings("discovery");
  const ctx: Ctx = { run, fetcher: new PoliteFetcher({ minDelayMs: s.minDelayMsPerHost, runId }), deadline };
  let processed = 0;
  let budgetStopped = Boolean((run.plan as { budgetStopped?: boolean }).budgetStopped);
  // A few tasks run concurrently (different companies = different hosts; per-host politeness is kept
  // by the shared fetcher). Each worker claims its own task under a lease.
  const workers = Math.max(1, Math.min(8, s.concurrency));
  const worker = async () => {
    while (Date.now() < deadline - 5_000) {
      const task = await claimTask(runId, budgetStopped);
      if (!task) return;
      processed++;
      try {
        const result = await execute(task, ctx);
        await finishTask(task.id, "done", { result });
      } catch (e) {
        if (e instanceof BudgetExceededError) {
          if (!budgetStopped) {
            budgetStopped = true;
            await db()
              .update(jobRuns)
              .set({
                plan: sql`${jobRuns.plan} || ${JSON.stringify({ budgetStopped: true, budgetMessage: e.message })}::jsonb`,
              })
              .where(eq(jobRuns.id, runId));
            await logEvent("warning", "discovery", `Płatne operacje zatrzymane: ${e.message}`, {}, runId);
          }
          await finishTask(task.id, "skipped", { error: `Limit wydatków: ${e.message}` });
          continue;
        }
        if (e instanceof SourceUnavailable) {
          await finishTask(task.id, "done", { result: { ...e.result, unavailable: true } });
          continue;
        }
        const retryable =
          e instanceof RateLimitedError ||
          (e instanceof ProviderError && e.retryable) ||
          !(e instanceof ProviderError);
        const msg = e instanceof Error ? e.message : String(e);
        if (retryable && task.attempts < task.maxAttempts) {
          const wait =
            e instanceof RateLimitedError
              ? e.retryAfterMs
              : Math.min(30 * 60_000, 2 ** task.attempts * 60_000);
          await finishTask(task.id, "pending", { error: msg, nextAttemptAt: new Date(Date.now() + wait) });
        } else {
          await finishTask(task.id, "failed", { error: msg.slice(0, 500) });
          await logEvent(
            "warning",
            "discovery",
            `Zadanie ${task.kind} nie powiodło się`,
            { key: task.key, message: msg.slice(0, 300) },
            runId,
          );
        }
      }
      await db().update(jobRuns).set({ heartbeatAt: new Date() }).where(eq(jobRuns.id, runId));
    }
  };
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return finalizeIfDone(runId, processed);
}

async function finalizeIfDone(runId: string, processed: number): Promise<SliceResult> {
  const rows = await db()
    .select({
      kind: jobTasks.kind,
      status: jobTasks.status,
      result: jobTasks.result,
      error: jobTasks.error,
      attempts: jobTasks.attempts,
      max: jobTasks.maxAttempts,
    })
    .from(jobTasks)
    .where(eq(jobTasks.runId, runId));
  const [run] = await db().select().from(jobRuns).where(eq(jobRuns.id, runId)).limit(1);
  const budgetStopped = Boolean((run?.plan as { budgetStopped?: boolean } | undefined)?.budgetStopped);
  const open = rows.filter(
    (r) =>
      (r.status === "pending" || r.status === "running") &&
      !(budgetStopped && (r.kind === "enrich_company" || r.kind === "enrich_person")),
  );
  const stats = computeStats(rows);
  const cost = await db().execute<{ c: number }>(
    sql`select coalesce(sum(cost_micros),0)::bigint as c from provider_usage where run_id = ${runId} and status in ('committed','reserved')`,
  );
  const costMicros = Number((cost as unknown as { c: number }[])[0]?.c ?? 0);
  if (open.length > 0) {
    await db().update(jobRuns).set({ stats, costMicros }).where(eq(jobRuns.id, runId));
    return { runId, processed, remaining: open.length, finished: false, status: "running" };
  }
  // Paid tasks left pending after a budget stop are closed as skipped.
  if (budgetStopped) {
    await db()
      .update(jobTasks)
      .set({ status: "skipped", error: "Pominięte: limit wydatków" })
      .where(and(eq(jobTasks.runId, runId), inArray(jobTasks.status, ["pending", "running"])));
  }
  const failed = rows.filter((r) => r.status === "failed").length;
  const done = rows.filter((r) => r.status === "done").length;
  const research = rows.filter((r) => r.kind === "research_company");
  const researchUnavailable = research.filter(
    (r) => (r.result as { unavailable?: boolean } | null)?.unavailable,
  ).length;
  let status: RunRow["status"];
  let error: string | null = null;
  if (done === 0 && failed > 0) {
    status = "failed";
    error = `Wszystkie zadania nie powiodły się (${failed}).`;
  } else if (research.length >= 3 && researchUnavailable === research.length) {
    status = "failed";
    error = "Żadna strona firmowa nie była dostępna — prawdopodobnie problem z siecią.";
  } else if (budgetStopped) status = "budget_exhausted";
  else if (failed > 0) status = "partial";
  else status = "succeeded";
  await db()
    .update(jobRuns)
    .set({ status, stats, costMicros, error, finishedAt: new Date(), leaseOwner: null })
    .where(eq(jobRuns.id, runId));
  if (status === "failed")
    await logEvent("error", "discovery", error ?? "Przebieg nie powiódł się", {}, runId);
  return { runId, processed, remaining: 0, finished: true, status };
}

function computeStats(
  rows: { kind: string; status: string; result: Record<string, unknown> | null }[],
): RunStats {
  const s: RunStats = {
    companiesDiscovered: 0,
    companiesResearched: 0,
    contactsNew: 0,
    contactsUpdated: 0,
    contactsRechecked: 0,
    emailsVerified: 0,
    pagesFetched: 0,
    tasksDone: 0,
    tasksFailed: 0,
    tasksSkipped: 0,
    unresolvedCompanies: 0,
  };
  for (const r of rows) {
    if (r.status === "done") s.tasksDone!++;
    if (r.status === "failed") s.tasksFailed!++;
    if (r.status === "skipped") s.tasksSkipped!++;
    const res = r.result ?? {};
    if (r.kind === "find_companies") s.companiesDiscovered! += Number(res.companiesDiscovered ?? 0);
    if (r.kind === "research_company" && r.status === "done") {
      s.companiesResearched!++;
      s.contactsNew! += Number(res.created ?? 0);
      s.contactsUpdated! += Number(res.updated ?? 0);
      s.pagesFetched! += Number(res.pagesFetched ?? 0);
      if (res.outcome !== "relevant_contact_found") s.unresolvedCompanies!++;
    }
    if (r.kind === "enrich_company" && r.status === "done") s.contactsNew! += Number(res.created ?? 0);
    if (r.kind === "enrich_person" && r.status === "done" && res.status === "found") s.contactsUpdated!++;
    if (r.kind === "verify_email" && r.status === "done") s.emailsVerified!++;
    if (r.kind === "recheck_employment" && r.status === "done") s.contactsRechecked!++;
  }
  return s;
}

/** Runs whose worker died (lease/heartbeat expired) are simply picked up again by the next tick. */
export async function resumableRuns(): Promise<RunRow[]> {
  return db()
    .select()
    .from(jobRuns)
    .where(and(eq(jobRuns.kind, "discovery"), inArray(jobRuns.status, ["queued", "running"])))
    .orderBy(asc(jobRuns.createdAt));
}

export async function recentRuns(limit = 30) {
  return db().select().from(jobRuns).orderBy(desc(jobRuns.createdAt)).limit(limit);
}
