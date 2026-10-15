/** Wydarzenia: list, detail, status and note, events added by hand, calendar files, watched pages. */
import { and, asc, count, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { scoreEvent } from "@/lib/events/match";
import { db } from "../db/client.ts";
import { eventSources, events } from "../db/schema.ts";
import { notFound } from "../http.ts";
import { EVENT_SOURCES, OTHER_WAYS } from "./sources.ts";

export const EVENT_VIEWS = ["best", "soon", "warsaw", "online", "mine", "all"] as const;
export type EventView = (typeof EVENT_VIEWS)[number];
export const EVENT_SHOW_FROM = 45;

const upcoming = sql`coalesce(${events.endsAt}, ${events.startsAt}) >= now() - interval '12 hours'`;
const notHidden = sql`${events.status} <> 'dismissed'`;

function viewWhere(view: EventView): SQL | undefined {
  switch (view) {
    case "best":
      return and(upcoming, notHidden, sql`${events.score} >= ${EVENT_SHOW_FROM}`);
    case "soon":
      return and(
        upcoming,
        notHidden,
        sql`${events.startsAt} <= now() + interval '30 days'`,
        sql`${events.score} >= 30`,
      );
    case "warsaw":
      return and(upcoming, notHidden, sql`${events.place} ~* '(warszaw|warsaw)'`);
    case "online":
      return and(upcoming, notHidden, eq(events.online, true));
    case "mine":
      return and(
        sql`${events.status} in ('saved','going')`,
        sql`coalesce(${events.endsAt}, ${events.startsAt}) >= now() - interval '30 days'`,
      );
    default:
      return and(upcoming, notHidden);
  }
}

const sourceName = (key: string) =>
  key === "manual" ? "Dodane ręcznie" : (EVENT_SOURCES.find((s) => s.key === key)?.name ?? key);

export async function listEvents(opts: { view: EventView; q?: string; offset?: number }) {
  let where = viewWhere(opts.view);
  const q = opts.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_]/g, "")}%`;
    where = and(
      where,
      or(ilike(events.title, like), ilike(events.organiser, like), ilike(events.place, like)),
    );
  }
  const rows = await db()
    .select({
      id: events.id,
      source: events.source,
      title: events.title,
      organiser: events.organiser,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      allDay: events.allDay,
      place: events.place,
      online: events.online,
      price: events.price,
      score: events.score,
      reasons: events.reasons,
      status: events.status,
      url: events.url,
    })
    .from(events)
    .where(where)
    .orderBy(asc(events.startsAt), desc(events.score))
    .limit(60)
    .offset(opts.offset ?? 0);
  const counts: Record<string, number> = {};
  for (const v of EVENT_VIEWS) {
    const [c] = await db().select({ n: count() }).from(events).where(viewWhere(v));
    counts[v] = c?.n ?? 0;
  }
  const sources = await db().select().from(eventSources);
  const byKey = new Map(sources.map((s) => [s.key, s]));
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  const watched = EVENT_SOURCES.filter((s) => s.kind === "watch").map((s) => {
    const r = byKey.get(s.key);
    const changed = r?.changedAt && (!r.seenAt || r.changedAt > r.seenAt);
    return {
      key: s.key,
      name: s.name,
      url: s.url,
      note: s.note ?? null,
      checkedAt: iso(r?.lastCheckedAt ?? null),
      changedAt: iso(r?.changedAt ?? null),
      newLines: changed ? (r?.newLines ?? []) : [],
      isNew: Boolean(changed),
      error: r?.lastStatus === "error" ? (r.lastError ?? "błąd") : null,
    };
  });
  const lastSync = sources.reduce<Date | null>(
    (m, s) => (s.lastCheckedAt && (!m || s.lastCheckedAt > m) ? s.lastCheckedAt : m),
    null,
  );
  return {
    rows: rows.map((r) => ({
      ...r,
      sourceName: sourceName(r.source),
      startsAt: r.startsAt.toISOString(),
      endsAt: iso(r.endsAt),
    })),
    counts,
    watched: watched.sort((a, b) => Number(b.isNew) - Number(a.isNew)),
    ways: OTHER_WAYS,
    feeds: EVENT_SOURCES.filter((s) => s.kind === "feed").map((s) => ({ name: s.name, url: s.url })),
    lastSyncAt: iso(lastSync),
  };
}
export type EventList = Awaited<ReturnType<typeof listEvents>>;

export async function eventDetail(id: string) {
  const [e] = await db().select().from(events).where(eq(events.id, id)).limit(1);
  if (!e) throw notFound("Wydarzenie nie istnieje");
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return {
    ...e,
    sourceName: sourceName(e.source),
    sourceUrl: EVENT_SOURCES.find((s) => s.key === e.source)?.url ?? null,
    startsAt: e.startsAt.toISOString(),
    endsAt: iso(e.endsAt),
    statusAt: iso(e.statusAt),
    firstSeenAt: e.firstSeenAt.toISOString(),
    lastSeenAt: e.lastSeenAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}
export type EventDetail = Awaited<ReturnType<typeof eventDetail>>;

export async function setEventStatus(
  id: string,
  patch: { status?: "new" | "saved" | "going" | "dismissed"; note?: string | null },
) {
  const [u] = await db()
    .update(events)
    .set({
      ...(patch.status ? { status: patch.status, statusAt: new Date() } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      updatedAt: new Date(),
    })
    .where(eq(events.id, id))
    .returning({ id: events.id });
  if (!u) throw notFound("Wydarzenie nie istnieje");
}

/** An event found elsewhere (LinkedIn, a newsletter, a friend): saved with the owner's details. */
export async function addManualEvent(e: {
  title: string;
  startsAt: Date;
  allDay: boolean;
  place: string | null;
  online: boolean;
  url: string;
  organiser: string | null;
}) {
  const m = scoreEvent({
    title: e.title,
    text: "",
    organiser: e.organiser,
    place: e.place,
    online: e.online,
  });
  const [row] = await db()
    .insert(events)
    .values({
      source: "manual",
      externalId: `${e.url}#${e.startsAt.toISOString()}`,
      ...e,
      score: m.score,
      reasons: m.reasons,
      status: "saved",
      statusAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [events.source, events.externalId],
      set: {
        title: e.title,
        place: e.place,
        online: e.online,
        organiser: e.organiser,
        updatedAt: new Date(),
      },
    })
    .returning({ id: events.id });
  return row!.id;
}

// ------------------------------------------------------------------------------------------------
// Calendar file (.ics) for one event: "Dodaj do kalendarza"
// ------------------------------------------------------------------------------------------------

const icsText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");
/** RFC 5545: lines longer than 75 characters continue on the next line after a space. */
const fold = (line: string) => line.match(/.{1,74}/gu)?.join("\r\n ") ?? line;
const icsDateTime = (d: Date) => `${d.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
const icsDate = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" }).replace(/-/g, "");

export async function eventIcs(id: string): Promise<{ body: string; filename: string }> {
  const e = await eventDetail(id);
  const start = new Date(e.startsAt);
  const end = e.endsAt ? new Date(e.endsAt) : null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mind The Gap//Outreach Studio//PL",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}@mindthegap-outreach`,
    `DTSTAMP:${icsDateTime(new Date())}`,
    ...(e.allDay
      ? [
          `DTSTART;VALUE=DATE:${icsDate(start)}`,
          `DTEND;VALUE=DATE:${icsDate(new Date((end ?? start).getTime() + 86_400_000))}`,
        ]
      : [
          `DTSTART:${icsDateTime(start)}`,
          `DTEND:${icsDateTime(end ?? new Date(start.getTime() + 2 * 3_600_000))}`,
        ]),
    `SUMMARY:${icsText(e.title)}`,
    ...(e.place || e.online ? [`LOCATION:${icsText(e.place ?? "Online")}`] : []),
    `URL:${e.url}`,
    `DESCRIPTION:${icsText(`${e.url}\n\n${e.description.slice(0, 1500)}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const name =
    e.title
      .replace(/[\\/:*?"<>|\p{Cc}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "wydarzenie";
  return { body: `${lines.map(fold).join("\r\n")}\r\n`, filename: `${name}.ics` };
}
