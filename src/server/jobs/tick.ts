/**
 * One scheduler tick. Called by an external scheduler (Cloud Scheduler / GitHub Actions / cron) through
 * `POST /api/cron/tick` or `pnpm worker tick`. Each duty has its own lease, so overlapping ticks never run
 * the same work twice. Everything is bounded by the tick's time budget; unfinished work resumes next tick.
 */

import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { and, eq, lte, sql } from "drizzle-orm";
import { decideScheduledRun, localDate } from "@/lib/time";
import { jobsWorkDue, type SyncReport, syncJobs } from "../careers/sync.ts";
import { db } from "../db/client.ts";
import { contacts, jobRuns, settings } from "../db/schema.ts";
import { logEvent } from "../events.ts";
import { sendDueMessages } from "../gmail/dispatch.ts";
import { syncRepliesIfDue } from "../gmail/sync.ts";
import { refreshDerived } from "../services/contacts.ts";
import { applyRetention } from "../services/privacy.ts";
import { getSettings } from "../settings.ts";
import { acquireLease, releaseLease } from "./lease.ts";
import { createScheduledRun, processRun, resumableRuns, type SliceResult } from "./runs.ts";

export type TickReport = {
  at: string;
  holder: string;
  schedule: string;
  createdRun: string | null;
  slices: SliceResult[];
  sends: { sent: number; failed: number; skipped: number } | null;
  sync: { synced: boolean; replies?: number; error?: string } | null;
  followUpsRefreshed: number;
  retention: { deleted: number } | null;
  jobs: SyncReport | null;
  busy: string[];
};

export async function recordTick(report: Partial<TickReport>) {
  const value = { lastTickAt: new Date().toISOString(), last: report };
  await db()
    .insert(settings)
    .values({ key: "tick_state", value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function runTick(opts: {
  budgetMs: number;
  trigger: string;
  holder?: string;
  discovery?: boolean;
  jobs?: boolean;
}): Promise<TickReport> {
  const holder = opts.holder ?? `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  const start = Date.now();
  const deadline = start + opts.budgetMs;
  const report: TickReport = {
    at: new Date(start).toISOString(),
    holder,
    schedule: "",
    createdRun: null,
    slices: [],
    sends: null,
    sync: null,
    followUpsRefreshed: 0,
    retention: null,
    jobs: null,
    busy: [],
  };
  await recordTick({ ...report, schedule: `started (${opts.trigger})` });

  // 1. Scheduled sends (short, time-sensitive).
  if (await acquireLease("send", holder, 10 * 60_000)) {
    try {
      report.sends = await sendDueMessages({ deadline: Math.min(deadline, Date.now() + 120_000) });
    } catch (e) {
      await logEvent("error", "gmail", "Wysyłka zaplanowanych wiadomości nie powiodła się", {
        message: errMsg(e),
      });
    } finally {
      await releaseLease("send", holder);
    }
  } else report.busy.push("send");

  // 2. Reply sync.
  if (await acquireLease("sync", holder, 10 * 60_000)) {
    try {
      report.sync = await syncRepliesIfDue();
    } catch (e) {
      report.sync = { synced: false, error: errMsg(e) };
    } finally {
      await releaseLease("sync", holder);
    }
  } else report.busy.push("sync");

  // 3. Follow-ups that became due.
  const due = await db()
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.outreachStatus, "sent"), lte(contacts.followUpAt, new Date())));
  if (due.length) await refreshDerived(due.map((d) => d.id));
  report.followUpsRefreshed = due.length;

  // 4. Retention, at most once per local day.
  const today = localDate(new Date());
  if (await acquireLease(`retention:${today}`, holder, 26 * 3_600_000)) {
    try {
      report.retention = await applyRetention();
    } catch (e) {
      await logEvent("warning", "privacy", "Retencja danych nie powiodła się", { message: errMsg(e) });
    }
    // The lease intentionally stays until it expires: it marks "done today".
  }

  // 5. Oferty pracy: read due job boards (every few hours) and look for boards on company sites.
  if (opts.jobs !== false && Date.now() < deadline - 60_000 && (await jobsWorkDue())) {
    if (await acquireLease("jobs", holder, 5 * 60_000)) {
      try {
        report.jobs = await syncJobs({ deadline: Math.min(deadline - 30_000, Date.now() + 110_000) });
      } catch (e) {
        await logEvent("error", "jobs", "Pobieranie ofert pracy nie powiodło się", { message: errMsg(e) });
      } finally {
        await releaseLease("jobs", holder);
      }
    } else report.busy.push("jobs");
  }

  // 6. Discovery: start today's scheduled run when due, then work on any active run.
  if (opts.discovery !== false) {
    const sched = await getSettings("scheduler");
    const ran = await db()
      .select({ d: jobRuns.localDate })
      .from(jobRuns)
      .where(
        and(
          eq(jobRuns.kind, "discovery"),
          sql`${jobRuns.trigger} in ('schedule','catch_up')`,
          eq(jobRuns.localDate, today),
        ),
      );
    const decision = decideScheduledRun({
      now: new Date(),
      enabled: sched.enabled,
      localTime: sched.localTime,
      zone: sched.timezone,
      ranForLocalDate: () => ran.length > 0,
      onTimeWindowMinutes: sched.onTimeWindowMinutes,
    });
    report.schedule = decision.due ? `due (${decision.trigger})` : decision.reason;
    if (decision.due) {
      const run = await createScheduledRun(decision.localDate, decision.trigger);
      report.createdRun = run?.id ?? null;
      if (run && decision.trigger === "catch_up") {
        await logEvent(
          "info",
          "scheduler",
          `Przebieg z ${decision.localDate} uruchomiony z opóźnieniem (polityka nadrabiania).`,
          {},
          run.id,
        );
      }
    }
    if (
      Date.now() < deadline - 15_000 &&
      (await acquireLease("discovery-worker", holder, opts.budgetMs + 60_000))
    ) {
      try {
        for (const run of await resumableRuns()) {
          if (Date.now() >= deadline - 15_000) break;
          report.slices.push(await processRun(run.id, deadline, holder));
        }
      } catch (e) {
        await logEvent("error", "discovery", "Błąd podczas przetwarzania przebiegu", { message: errMsg(e) });
      } finally {
        await releaseLease("discovery-worker", holder);
      }
    } else report.busy.push("discovery");
  }

  await recordTick(report);
  return report;
}

function errMsg(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}
