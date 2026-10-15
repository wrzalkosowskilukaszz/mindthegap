/** Zapytania ofertowe: list, detail (full text fetched on demand), status and note. */
import { and, count, desc, eq, gte, ilike, isNull, lte, ne, or, type SQL, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { tenders } from "../db/schema.ts";
import { notFound } from "../http.ts";
import { BK_SOURCE_LINE } from "./bk.ts";
import { refreshDetail, tendersFetcher, tendersState } from "./sync.ts";

export const TENDER_VIEWS = ["best", "new", "closing", "saved", "applied", "all"] as const;
export type TenderView = (typeof TENDER_VIEWS)[number];
/** "Pasujące" starts here: at least one of the owner's topics and nothing clearly off-topic. */
export const TENDER_SHOW_FROM = 45;

/** Warsaw, Mazovia, anywhere in Poland, several places or online. */
const NEAR = sql`(${tenders.place} ~* '(warszaw|mazowieck|ca[łl]a polska|wiele miejsc|online|zdaln)')`;

function viewWhere(view: TenderView): SQL | undefined {
  const open = isNull(tenders.closedAt);
  const active = sql`${tenders.status} in ('new','saved')`;
  switch (view) {
    case "best":
      return and(open, active, gte(tenders.score, TENDER_SHOW_FROM));
    case "new":
      return and(
        open,
        eq(tenders.status, "new"),
        gte(tenders.firstSeenAt, new Date(Date.now() - 3 * 86_400_000)),
        gte(tenders.score, 25),
      );
    case "closing":
      return and(
        open,
        active,
        gte(tenders.score, TENDER_SHOW_FROM),
        lte(tenders.deadlineAt, new Date(Date.now() + 5 * 86_400_000)),
      );
    case "saved":
      return eq(tenders.status, "saved");
    case "applied":
      return eq(tenders.status, "applied");
    default:
      return and(open, ne(tenders.status, "dismissed"));
  }
}

export async function listTenders(opts: { view: TenderView; q?: string; near?: boolean; offset?: number }) {
  let where = viewWhere(opts.view);
  if (opts.near) where = and(where, NEAR);
  const q = opts.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    where = and(
      where,
      or(ilike(tenders.title, like), ilike(tenders.advertiser, like), ilike(tenders.place, like)),
    );
  }
  const order =
    opts.view === "new"
      ? [desc(tenders.firstSeenAt), desc(tenders.score)]
      : opts.view === "closing"
        ? [sql`${tenders.deadlineAt} asc nulls last`]
        : opts.view === "applied" || opts.view === "saved"
          ? [desc(tenders.statusAt)]
          : [desc(tenders.score), sql`${tenders.deadlineAt} asc nulls last`];
  const rows = await db()
    .select({
      id: tenders.id,
      title: tenders.title,
      advertiser: tenders.advertiser,
      place: tenders.place,
      deadlineAt: tenders.deadlineAt,
      publishedOn: tenders.publishedOn,
      firstSeenAt: tenders.firstSeenAt,
      closedAt: tenders.closedAt,
      score: tenders.score,
      reasons: tenders.reasons,
      status: tenders.status,
      url: tenders.url,
    })
    .from(tenders)
    .where(where)
    .orderBy(...order)
    .limit(60)
    .offset(opts.offset ?? 0);

  const counts: Record<string, number> = {};
  for (const v of TENDER_VIEWS) {
    const [c] = await db()
      .select({ n: count() })
      .from(tenders)
      .where(opts.near ? and(viewWhere(v), NEAR) : viewWhere(v));
    counts[v] = c?.n ?? 0;
  }
  const [open] = await db().select({ n: count() }).from(tenders).where(isNull(tenders.closedAt));
  const state = await tendersState();
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    rows: rows.map((r) => ({
      ...r,
      deadlineAt: iso(r.deadlineAt),
      firstSeenAt: r.firstSeenAt.toISOString(),
      closedAt: iso(r.closedAt),
    })),
    counts,
    sync: {
      lastSyncAt: state.lastSyncAt,
      openTotal: open?.n ?? 0,
      complete: state.last?.complete ?? null,
      sourceLine: BK_SOURCE_LINE,
    },
  };
}
export type TenderList = Awaited<ReturnType<typeof listTenders>>;

async function tenderRow(id: string) {
  const [t] = await db().select().from(tenders).where(eq(tenders.id, id)).limit(1);
  if (!t) throw notFound("Zapytanie nie istnieje");
  return t;
}

export async function tenderDetail(id: string) {
  let t = await tenderRow(id);
  // The full text is fetched when first opened (or once a day while the request is open).
  const stale = !t.detailFetchedAt || Date.now() - t.detailFetchedAt.getTime() > 86_400_000;
  let detailError: string | null = null;
  if (stale && !t.closedAt && t.source === "bk") {
    try {
      await refreshDetail(tendersFetcher(), t.id, t.externalId);
      t = await tenderRow(id);
    } catch (e) {
      if (!t.detail) detailError = e instanceof Error ? e.message : "error";
    }
  }
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    ...t,
    deadlineAt: iso(t.deadlineAt),
    detailFetchedAt: iso(t.detailFetchedAt),
    firstSeenAt: t.firstSeenAt.toISOString(),
    lastSeenAt: t.lastSeenAt.toISOString(),
    closedAt: iso(t.closedAt),
    statusAt: iso(t.statusAt),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    detailError,
    sourceLine: BK_SOURCE_LINE,
  };
}
export type TenderDetailView = Awaited<ReturnType<typeof tenderDetail>>;

export async function setTenderStatus(
  id: string,
  patch: { status?: "new" | "saved" | "applied" | "dismissed"; note?: string | null },
) {
  const [u] = await db()
    .update(tenders)
    .set({
      ...(patch.status ? { status: patch.status, statusAt: new Date() } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tenders.id, id))
    .returning({ id: tenders.id });
  if (!u) throw notFound("Zapytanie nie istnieje");
}
