/**
 * Zapytania ofertowe sync: every 12 hours, read the open requests in Baza Konkurencyjności's training
 * category plus a few title searches (coaching, warsztaty, trener…), score them, then fetch the full text of
 * new relevant ones. About 20 paced requests a run. Safe to run twice (unique source + id).
 */
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { scoreTender } from "@/lib/tenders/match";
import { db } from "../db/client.ts";
import { settings, tenders } from "../db/schema.ts";
import { PoliteFetcher } from "../discovery/fetcher.ts";
import { BK_QUERIES, BkError, type BkListItem, bkDetail, bkSearch, bkUrl } from "./bk.ts";

export const TENDERS_EVERY_HOURS = 12;
/** Full text is fetched ahead of time only for requests at least this relevant. */
const DETAIL_FROM = 40;

export type TendersReport = {
  read: number;
  added: number;
  updated: number;
  details: number;
  closed: number;
  complete: boolean;
  errors: string[];
};

export function tendersFetcher() {
  return new PoliteFetcher({ minDelayMs: 1500, timeoutMs: 15_000 });
}

export async function syncTenders(opts: { deadline: number }): Promise<TendersReport> {
  const left = () => opts.deadline - Date.now();
  const f = tendersFetcher();
  const report: TendersReport = {
    read: 0,
    added: 0,
    updated: 0,
    details: 0,
    closed: 0,
    complete: true,
    errors: [],
  };
  const seen = new Map<string, BkListItem>();

  // 1. The whole training category (about 170 open requests), then title searches across categories.
  try {
    for (let page = 1; page <= 4; page++) {
      if (left() < 15_000) {
        report.complete = false;
        break;
      }
      const r = await bkSearch(f, { trainingCategory: true, page, limit: 100 });
      for (const it of r.items) seen.set(it.externalId, it);
      if (page * 100 >= r.total || !r.items.length) break;
    }
    for (const q of BK_QUERIES) {
      if (left() < 15_000) {
        report.complete = false;
        break;
      }
      const r = await bkSearch(f, { query: q, page: 1, limit: 100 });
      for (const it of r.items) seen.set(it.externalId, it);
    }
  } catch (e) {
    report.complete = false;
    report.errors.push(e instanceof BkError ? e.message : String(e).slice(0, 200));
  }
  report.read = seen.size;

  // 2. Store and score. A stored full text keeps improving the score.
  const items = [...seen.values()];
  const existing = items.length
    ? await db()
        .select({ id: tenders.id, externalId: tenders.externalId, detail: tenders.detail })
        .from(tenders)
        .where(
          and(
            eq(tenders.source, "bk"),
            inArray(
              tenders.externalId,
              items.map((i) => i.externalId),
            ),
          ),
        )
    : [];
  const byExt = new Map(existing.map((e) => [e.externalId, e]));
  const now = new Date();
  for (const it of items) {
    const prev = byExt.get(it.externalId);
    const m = scoreTender({
      title: it.title,
      text: prev?.detail?.description || it.snippet,
      place: it.place,
      conditions: prev?.detail?.conditions,
    });
    const values = {
      title: it.title,
      advertiser: it.advertiser,
      place: it.place,
      snippet: it.snippet,
      url: bkUrl(it.externalId),
      publishedOn: it.publishedOn,
      deadlineAt: it.deadlineAt,
      score: m.score,
      reasons: m.reasons,
      lastSeenAt: now,
      closedAt: null,
      updatedAt: now,
    };
    if (prev) {
      await db().update(tenders).set(values).where(eq(tenders.id, prev.id));
      report.updated++;
    } else {
      await db()
        .insert(tenders)
        .values({ source: "bk", externalId: it.externalId, ...values })
        .onConflictDoNothing();
      report.added++;
    }
  }

  // 3. Closed: the deadline passed, or (after a complete read) no longer published.
  const closedDeadline = await db()
    .update(tenders)
    .set({ closedAt: now })
    .where(and(isNull(tenders.closedAt), lt(tenders.deadlineAt, now)))
    .returning({ id: tenders.id });
  report.closed += closedDeadline.length;
  // A suspiciously small complete read (a glitch on the other side) never closes everything.
  if (report.complete && report.read >= 20) {
    const gone = await db()
      .update(tenders)
      .set({ closedAt: now })
      .where(and(isNull(tenders.closedAt), lt(tenders.lastSeenAt, new Date(now.getTime() - 60_000))))
      .returning({ id: tenders.id });
    report.closed += gone.length;
  }

  // 4. Full text of new relevant requests, best first, while time allows.
  const want = await db()
    .select({ id: tenders.id, externalId: tenders.externalId })
    .from(tenders)
    .where(
      and(isNull(tenders.closedAt), isNull(tenders.detailFetchedAt), sql`${tenders.score} >= ${DETAIL_FROM}`),
    )
    .orderBy(desc(tenders.score))
    .limit(40);
  for (const t of want) {
    if (left() < 8_000) break;
    try {
      await refreshDetail(f, t.id, t.externalId);
      report.details++;
    } catch (e) {
      report.errors.push(
        `detail ${t.externalId}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200),
      );
    }
  }

  await saveTendersState(report);
  return report;
}

/** Fetch one request's full text and conditions, then re-score it with them. */
export async function refreshDetail(f: PoliteFetcher, id: string, externalId: string) {
  const d = await bkDetail(f, externalId);
  const [row] = await db()
    .select({ title: tenders.title, place: tenders.place, snippet: tenders.snippet })
    .from(tenders)
    .where(eq(tenders.id, id))
    .limit(1);
  if (!row) return;
  const m = scoreTender({
    title: row.title,
    text: d.description || row.snippet,
    place: d.places.join("; ") || row.place,
    conditions: d.conditions,
  });
  const { number, deadlineAt, ...detail } = d;
  await db()
    .update(tenders)
    .set({
      detail,
      detailFetchedAt: new Date(),
      number,
      ...(deadlineAt ? { deadlineAt } : {}),
      score: m.score,
      reasons: m.reasons,
      updatedAt: new Date(),
    })
    .where(eq(tenders.id, id));
}

async function saveTendersState(last: TendersReport) {
  const value = { lastSyncAt: new Date().toISOString(), last };
  await db()
    .insert(settings)
    .values({ key: "tenders_state", value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export async function tendersState(): Promise<{ lastSyncAt: string | null; last: TendersReport | null }> {
  const [row] = await db().select().from(settings).where(eq(settings.key, "tenders_state")).limit(1);
  const v = (row?.value ?? {}) as { lastSyncAt?: string; last?: TendersReport };
  return { lastSyncAt: v.lastSyncAt ?? null, last: v.last ?? null };
}

export async function tendersDue(now = new Date()): Promise<boolean> {
  const s = await tendersState();
  return !s.lastSyncAt || now.getTime() - new Date(s.lastSyncAt).getTime() >= TENDERS_EVERY_HOURS * 3_600_000;
}
