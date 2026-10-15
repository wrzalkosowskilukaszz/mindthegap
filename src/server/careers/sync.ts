/**
 * Oferty pracy sync: find job boards on company websites, read due sources, score every offer against
 * the owner's preferences and CV, keep the relevant ones, close the ones that disappeared.
 * Bounded by a deadline; whatever is left continues on the next tick. Safe to run twice (unique keys).
 */
import { and, asc, eq, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import {
  type CareerPrefs,
  classifyLocation,
  scoreJob,
  titleLooksRelevant,
  worthKeeping,
} from "@/lib/jobs/match";
import { db } from "../db/client.ts";
import { companies, jobOffers, jobSources, settings } from "../db/schema.ts";
import { PoliteFetcher } from "../discovery/fetcher.ts";
import { env } from "../env.ts";
import { getSettings } from "../settings.ts";
import { detectCareers } from "./detect.ts";
import { fetchSource, type RawJob, SourceError, SUPPORTED_KINDS } from "./sources.ts";

const MEDIA_TECH = new Set(["telecom_media", "technology"]);
const RECHECK_CAREERS_DAYS = 30;

export async function careerPrefs(): Promise<CareerPrefs & { showFrom: number; syncEveryHours: number }> {
  const c = await getSettings("career");
  return {
    roleFamilies: c.roleFamilies,
    locations: c.locations,
    languages: c.languages,
    workTypes: c.workTypes,
    cvKeywords: c.cvKeywords,
    extraKeywords: c.extraKeywords,
    excludeKeywords: c.excludeKeywords,
    showFrom: c.showFrom,
    syncEveryHours: c.syncEveryHours,
  };
}

/** Feeds that do not belong to one company, plus company boards we know without detection. */
const KNOWN_BOARDS: { domain: string; kind: string; token: string; url: string }[] = [
  {
    domain: "netflix.com",
    kind: "eightfold",
    token: "explore.jobs.netflix.net|netflix.com",
    url: "https://jobs.netflix.com/",
  },
];

export async function ensureFeedSources(): Promise<void> {
  const e = env();
  type Kind = (typeof jobSources.$inferInsert)["kind"];
  const feeds: { kind: Kind; token: string; name: string; url: string }[] = [
    { kind: "arbeitnow", token: "arbeitnow", name: "Arbeitnow", url: "https://www.arbeitnow.com/" },
    { kind: "himalayas", token: "himalayas", name: "Himalayas", url: "https://himalayas.app/" },
    ...(e.ADZUNA_APP_ID && e.ADZUNA_APP_KEY
      ? [{ kind: "adzuna" as const, token: "adzuna", name: "Adzuna", url: "https://www.adzuna.pl/" }]
      : []),
    ...(e.JOOBLE_API_KEY
      ? [{ kind: "jooble" as const, token: "jooble", name: "Jooble", url: "https://pl.jooble.org/" }]
      : []),
  ];
  for (const f of feeds) {
    await db()
      .insert(jobSources)
      .values({ kind: f.kind, token: f.token, name: f.name, url: f.url })
      .onConflictDoNothing();
  }
  for (const k of KNOWN_BOARDS) {
    const [co] = await db().select().from(companies).where(eq(companies.domain, k.domain)).limit(1);
    if (!co) continue;
    await db()
      .insert(jobSources)
      .values({
        kind: k.kind as "eightfold",
        token: k.token,
        name: co.brand ?? co.name,
        companyId: co.id,
        url: k.url,
      })
      .onConflictDoNothing();
  }
}

type CompanyInfo = { id: string; name: string; sector: string; favourite: boolean };

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\b(s\.?a\.?|sp\.? z o\.?o\.?|gmbh|ltd|inc|plc|group|grupa|polska|poland|se|ag|b\.?v\.?)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function companyIndex(): Promise<Map<string, CompanyInfo>> {
  const rows = await db()
    .select({
      id: companies.id,
      name: companies.name,
      brand: companies.brand,
      sector: companies.sector,
      favourite: companies.favourite,
    })
    .from(companies)
    .where(eq(companies.excluded, false));
  const m = new Map<string, CompanyInfo>();
  for (const r of rows) {
    const info = { id: r.id, name: r.brand ?? r.name, sector: r.sector, favourite: r.favourite };
    for (const n of [r.name, r.brand]) if (n && normName(n).length >= 3) m.set(normName(n), info);
  }
  return m;
}

export type SyncReport = {
  detected: number;
  boardsFound: number;
  sources: { name: string; kept: number; total: number; error?: string }[];
  remainingDetect: number;
  remainingFetch: number;
  closed: number;
};

/** Companies whose careers page has not been looked for (or long ago). */
function detectDue() {
  return and(
    eq(companies.excluded, false),
    eq(companies.isDemo, false),
    sql`${companies.website} is not null`,
    or(
      isNull(companies.careersCheckedAt),
      lt(companies.careersCheckedAt, new Date(Date.now() - RECHECK_CAREERS_DAYS * 86_400_000)),
    ),
  );
}
function fetchDue() {
  return and(
    eq(jobSources.enabled, true),
    eq(jobSources.supported, true),
    or(isNull(jobSources.nextFetchAt), lte(jobSources.nextFetchAt, new Date())),
  );
}

/** Atomically takes the next due source and pushes its next read into the future. */
async function claimNextSource(hours: number) {
  const rows = await db().execute(sql`
    update job_sources set next_fetch_at = now() + make_interval(hours => ${hours})
    where id = (
      select id from job_sources
      where enabled and supported and (next_fetch_at is null or next_fetch_at <= now())
      order by next_fetch_at asc nulls first
      limit 1
      for update skip locked
    )
    returning id`);
  const id =
    (rows as unknown as { rows?: { id: string }[] }).rows?.[0]?.id ??
    (rows as unknown as { id: string }[])[0]?.id;
  if (!id) return null;
  const [src] = await db().select().from(jobSources).where(eq(jobSources.id, id)).limit(1);
  return src ?? null;
}

export async function syncJobs(opts: { deadline: number; detect?: boolean }): Promise<SyncReport> {
  const report: SyncReport = {
    detected: 0,
    boardsFound: 0,
    sources: [],
    remainingDetect: 0,
    remainingFetch: 0,
    closed: 0,
  };
  const prefs = await careerPrefs();
  const disc = await getSettings("discovery");
  const fetcher = new PoliteFetcher({
    minDelayMs: Math.min(disc.minDelayMsPerHost, 2000),
    timeoutMs: 12_000,
  });
  await ensureFeedSources();
  const left = () => opts.deadline - Date.now();
  // When boards are waiting to be read, website checks get only the first half of the time.
  const [waiting] = await db().select({ id: jobSources.id }).from(jobSources).where(fetchDue()).limit(1);
  const detectUntil = waiting ? Date.now() + left() / 2 : opts.deadline;

  // 1. Find job boards on company websites (a few companies at a time, different hosts in parallel).
  if (opts.detect !== false) {
    // A batch takes up to ~3 page reads of 12 s each; start one only with time to finish it.
    while (left() > 40_000 && Date.now() < detectUntil) {
      const batch = await db()
        .select({
          id: companies.id,
          name: companies.name,
          brand: companies.brand,
          website: companies.website,
        })
        .from(companies)
        .where(detectDue())
        .orderBy(asc(companies.favourite), asc(companies.createdAt))
        .limit(6);
      if (!batch.length) break;
      await Promise.all(
        batch.map(async (co) => {
          let found: Awaited<ReturnType<typeof detectCareers>> = { careersUrl: null, boards: [] };
          try {
            found = await detectCareers(fetcher, co.website!);
          } catch (e) {
            found = { careersUrl: null, boards: [], error: e instanceof Error ? e.message : String(e) };
          }
          await db()
            .update(companies)
            .set({
              careersCheckedAt: new Date(),
              careersUrl: found.careersUrl ?? found.boards[0]?.url ?? null,
            })
            .where(eq(companies.id, co.id));
          for (const b of found.boards) {
            await db()
              .insert(jobSources)
              .values({
                kind: b.kind as "greenhouse",
                token: b.token,
                name: co.brand ?? co.name,
                companyId: co.id,
                url: b.url,
                supported: b.supported && SUPPORTED_KINDS.has(b.kind),
              })
              .onConflictDoNothing();
            report.boardsFound++;
          }
          report.detected++;
        }),
      );
    }
  }

  // 2. Read due sources, three at a time (different sites; each site keeps its own polite pace).
  const index = await companyIndex();
  const worker = async () => {
    while (left() > 25_000) {
      const src = await claimNextSource(prefs.syncEveryHours);
      if (!src) return;
      const own = src.companyId
        ? (await db().select().from(companies).where(eq(companies.id, src.companyId)).limit(1))[0]
        : undefined;
      const ownInfo: CompanyInfo | undefined = own
        ? { id: own.id, name: own.brand ?? own.name, sector: own.sector, favourite: own.favourite }
        : undefined;
      const media = Boolean(ownInfo && (ownInfo.favourite || MEDIA_TECH.has(ownInfo.sector)));
      // Full texts only for promising titles, and never past the deadline (the list itself is quick).
      const want = (title: string, loc: string) =>
        left() > 8_000 &&
        titleLooksRelevant(title, prefs, media) &&
        classifyLocation({ location: loc }) !== "non_eu";
      try {
        const got = await fetchSource(fetcher, src, want);
        const kept = await storeJobs(src.id, got.jobs, ownInfo, index, prefs);
        let closed = 0;
        if (got.complete) {
          const seen = got.jobs.map((j) => j.externalId);
          const gone = await db()
            .update(jobOffers)
            .set({ closedAt: new Date(), updatedAt: new Date() })
            .where(
              and(
                eq(jobOffers.sourceId, src.id),
                isNull(jobOffers.closedAt),
                seen.length
                  ? sql`${jobOffers.externalId} not in (${sql.join(
                      seen.map((s) => sql`${s}`),
                      sql`, `,
                    )})`
                  : sql`true`,
              ),
            )
            .returning({ id: jobOffers.id });
          closed = gone.length;
        }
        report.closed += closed;
        await db()
          .update(jobSources)
          .set({
            lastFetchedAt: new Date(),
            lastStatus: "ok",
            lastError: null,
            jobsTotal: got.total,
            jobsKept: kept,
            updatedAt: new Date(),
          })
          .where(eq(jobSources.id, src.id));
        report.sources.push({ name: src.name, kept, total: got.total });
      } catch (e) {
        const kind = e instanceof SourceError ? e.kind : "http";
        const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
        await db()
          .update(jobSources)
          .set({
            lastFetchedAt: new Date(),
            lastStatus: kind === "robots" ? "robots" : "error",
            lastError: msg,
            // A board that refuses robots or no longer exists is asked again much later.
            nextFetchAt: new Date(
              Date.now() + (kind === "robots" || kind === "config" ? 7 * 24 : 12) * 3_600_000,
            ),
            updatedAt: new Date(),
          })
          .where(eq(jobSources.id, src.id));
        report.sources.push({ name: src.name, kept: 0, total: 0, error: msg });
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  // 3. Offers from search feeds are closed once they have not been seen for three weeks.
  const stale = await db()
    .update(jobOffers)
    .set({ closedAt: new Date() })
    .where(and(isNull(jobOffers.closedAt), lt(jobOffers.lastSeenAt, new Date(Date.now() - 21 * 86_400_000))))
    .returning({ id: jobOffers.id });
  report.closed += stale.length;

  const [{ n: rd } = { n: 0 }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(companies)
    .where(detectDue());
  const [{ n: rf } = { n: 0 }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(jobSources)
    .where(fetchDue());
  report.remainingDetect = opts.detect === false ? 0 : rd;
  report.remainingFetch = rf;
  await saveState(report);
  return report;
}

async function storeJobs(
  sourceId: string,
  jobs: RawJob[],
  own: CompanyInfo | undefined,
  index: Map<string, CompanyInfo>,
  prefs: CareerPrefs,
): Promise<number> {
  let kept = 0;
  const seenIds = new Set<string>();
  for (const j of jobs) {
    if (!j.externalId || !j.title || !j.url || seenIds.has(j.externalId)) continue;
    seenIds.add(j.externalId);
    const co = own ?? index.get(normName(j.companyName));
    const m = scoreJob(
      {
        title: j.title,
        description: j.description,
        location: j.location,
        countries: j.countries,
        workplace: j.workplace,
        employmentType: j.employmentType,
        companyName: co?.name ?? j.companyName,
        companySector: co?.sector ?? null,
        favourite: co?.favourite ?? false,
        postedAt: j.postedAt,
      },
      prefs,
    );
    if (!worthKeeping(m, co?.favourite ?? false)) continue;
    kept++;
    const values = {
      sourceId,
      externalId: j.externalId.slice(0, 300),
      companyId: co?.id ?? null,
      companyName: (co?.name ?? j.companyName).slice(0, 200),
      title: j.title.slice(0, 300),
      location: j.location?.slice(0, 300) ?? null,
      workplace: j.workplace ?? "unknown",
      employmentType: j.employmentType?.slice(0, 120) ?? null,
      department: j.department?.slice(0, 200) ?? null,
      description: j.description,
      url: j.url.slice(0, 2000),
      postedAt: j.postedAt,
      score: m.score,
      match: { reasons: m.reasons, region: m.region, requiredLanguages: m.requiredLanguages, hits: m.hits },
    };
    await db()
      .insert(jobOffers)
      .values(values)
      .onConflictDoUpdate({
        target: [jobOffers.sourceId, jobOffers.externalId],
        set: {
          ...values,
          // Keep a longer text fetched earlier when this read had none.
          description: j.description ? j.description : sql`${jobOffers.description}`,
          lastSeenAt: new Date(),
          closedAt: null,
          updatedAt: new Date(),
        },
      });
  }
  return kept;
}

/** Recomputes every open offer's score after the preferences or the CV change. */
export async function rescoreAll(refetch: { companyId?: string } | "all" = "all"): Promise<number> {
  const prefs = await careerPrefs();
  const rows = await db()
    .select({ o: jobOffers, sector: companies.sector, favourite: companies.favourite })
    .from(jobOffers)
    .leftJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(isNull(jobOffers.closedAt));
  for (const { o, sector, favourite } of rows) {
    const m = scoreJob(
      {
        title: o.title,
        description: o.description,
        location: o.location,
        workplace: o.workplace as "remote",
        employmentType: o.employmentType,
        companyName: o.companyName,
        companySector: sector,
        favourite: favourite ?? false,
        postedAt: o.postedAt,
      },
      prefs,
    );
    await db()
      .update(jobOffers)
      .set({
        score: m.score,
        match: { reasons: m.reasons, region: m.region, requiredLanguages: m.requiredLanguages, hits: m.hits },
      })
      .where(eq(jobOffers.id, o.id));
  }
  // Read the sources again soon, so offers that now match are picked up.
  await db()
    .update(jobSources)
    .set({ nextFetchAt: new Date() })
    .where(
      refetch === "all"
        ? ne(jobSources.kind, "manual")
        : refetch.companyId
          ? eq(jobSources.companyId, refetch.companyId)
          : sql`false`,
    );
  return rows.length;
}

export async function saveState(last: SyncReport) {
  const value = { lastSyncAt: new Date().toISOString(), last };
  await db()
    .insert(settings)
    .values({ key: "jobs_state", value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function jobsState(): Promise<{ lastSyncAt: string | null; last: SyncReport | null }> {
  const [row] = await db().select().from(settings).where(eq(settings.key, "jobs_state")).limit(1);
  const v = (row?.value ?? {}) as { lastSyncAt?: string; last?: SyncReport };
  return { lastSyncAt: v.lastSyncAt ?? null, last: v.last ?? null };
}

/** True when anything is waiting: a board due for reading or a company not yet checked. */
export async function jobsWorkDue(): Promise<boolean> {
  const [a] = await db().select({ id: jobSources.id }).from(jobSources).where(fetchDue()).limit(1);
  if (a) return true;
  const [b] = await db().select({ id: companies.id }).from(companies).where(detectDue()).limit(1);
  return Boolean(b);
}
