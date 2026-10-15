/**
 * Wydarzenia sync, once a day per source: read the event feeds, score each upcoming event, and look at the
 * watched conference pages for new lines with dates. About 20 paced requests a day. Safe to run twice.
 */
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { scoreEvent } from "@/lib/events/match";
import { htmlToText } from "../careers/text.ts";
import { db } from "../db/client.ts";
import { eventSources, events } from "../db/schema.ts";
import { PoliteFetcher } from "../discovery/fetcher.ts";
import { eventsFromIcal, eventsFromJsonLd, type RawEvent } from "./formats.ts";
import { EVENT_SOURCES, type EventSourceDef } from "./sources.ts";

const EVERY_MS = 20 * 3_600_000;
const HORIZON_MS = 400 * 86_400_000;

export type EventsReport = {
  checked: string[];
  added: number;
  updated: number;
  changedPages: string[];
  errors: string[];
  remaining: number;
};

const MONTHS =
  "stycz|lut|mar|kwie|kwiet|maj|czerw|lip|sierp|wrze|pa[źz]dz|list|grud|jan|feb|apr|may|jun|jul|aug|sep|oct|nov|dec";
const DATED = new RegExp(
  `(\\b\\d{1,2}[./-]\\d{1,2}([./-]\\d{2,4})?\\b|\\b20\\d{2}\\b|\\b\\d{1,2}(\\s*[-–]\\s*\\d{1,2})?\\s+(${MONTHS})\\p{L}*|\\b(${MONTHS})\\p{L}*\\.?\\s+\\d{1,2}\\b)`,
  "iu",
);

/** The lines of a page that carry a date: what changes when an event is announced or moved. */
export function datedLines(html: string): string[] {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, form, nav, footer, header").remove();
  const text = htmlToText($("main").html() ?? $("body").html() ?? "");
  const out = new Set<string>();
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 6 || line.length > 240) continue;
    if (/©|copyright|cookie|polityk\p{L}* prywatno/iu.test(line)) continue;
    if (DATED.test(line)) out.add(line);
    if (out.size >= 300) break;
  }
  return [...out];
}

const normTitle = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 60);
const dayKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });

/** Titles seen per Polish calendar day, with the source that listed them. */
type Seen = Map<string, { title: string; source: string }[]>;
function remember(seen: Seen, title: string, at: Date, source: string) {
  const day = dayKey(at);
  seen.set(day, [...(seen.get(day) ?? []), { title: normTitle(title), source }]);
}
/** The same event listed twice: same day, and one title starts with the other ("X Kongres HR 2027…"). */
export function sameEvent(seen: Seen, title: string, at: Date): string | null {
  const t = normTitle(title);
  if (t.length < 6) return null;
  for (const k of seen.get(dayKey(at)) ?? []) {
    const [a, b] = t.length <= k.title.length ? [t, k.title] : [k.title, t];
    if (b.startsWith(a) && a.length >= 10) return k.source;
    if (a === b) return k.source;
  }
  return null;
}

export function eventsFetcher() {
  return new PoliteFetcher({ minDelayMs: 2000, timeoutMs: 20_000 });
}

/** Rows for every source in the registry (new ones get added; the registry is the truth). */
async function ensureSources() {
  for (const s of EVENT_SOURCES) {
    await db()
      .insert(eventSources)
      .values({ key: s.key, name: s.name, url: s.url, kind: s.kind })
      .onConflictDoUpdate({
        target: eventSources.key,
        set: { name: s.name, url: s.url, kind: s.kind },
      });
  }
}

export async function eventsDue(now = new Date()): Promise<boolean> {
  const rows = await db()
    .select({ key: eventSources.key, at: eventSources.lastCheckedAt })
    .from(eventSources);
  const checked = new Map(rows.map((r) => [r.key, r.at]));
  return EVENT_SOURCES.some((s) => {
    const at = checked.get(s.key);
    return !at || now.getTime() - at.getTime() >= EVERY_MS;
  });
}

export async function syncEvents(opts: { deadline: number; force?: boolean }): Promise<EventsReport> {
  await ensureSources();
  const left = () => opts.deadline - Date.now();
  const report: EventsReport = {
    checked: [],
    added: 0,
    updated: 0,
    changedPages: [],
    errors: [],
    remaining: 0,
  };
  const rows = await db()
    .select()
    .from(eventSources)
    .where(
      inArray(
        eventSources.key,
        EVENT_SOURCES.map((s) => s.key),
      ),
    );
  const state = new Map(rows.map((r) => [r.key, r]));
  const due = EVENT_SOURCES.filter((s) => {
    const at = state.get(s.key)?.lastCheckedAt;
    return opts.force || !at || Date.now() - at.getTime() >= EVERY_MS;
  });
  const f = eventsFetcher();
  // Upcoming events already known, to skip the same event announced by two sources.
  const known = await db()
    .select({ source: events.source, title: events.title, startsAt: events.startsAt })
    .from(events)
    .where(gte(events.startsAt, new Date(Date.now() - 86_400_000)));
  const seen: Seen = new Map();
  for (const k of known) remember(seen, k.title, k.startsAt, k.source);

  for (const [i, s] of due.entries()) {
    if (left() < 12_000) {
      report.remaining = due.length - i;
      break;
    }
    try {
      await checkSource(f, s, state.get(s.key)?.lines ?? null, seen, report);
      report.checked.push(s.key);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      report.errors.push(`${s.key}: ${msg}`.slice(0, 200));
      await db()
        .update(eventSources)
        .set({
          lastCheckedAt: new Date(),
          lastStatus: "error",
          lastError: msg.slice(0, 300),
          updatedAt: new Date(),
        })
        .where(eq(eventSources.key, s.key));
    }
  }
  return report;
}

async function checkSource(
  f: PoliteFetcher,
  s: EventSourceDef,
  prevLines: string[] | null,
  seen: Seen,
  report: EventsReport,
) {
  const r = await f.get(s.url, s.format === "ical" ? "api" : "html");
  if (!r.ok) throw new Error(`${r.reason}${r.status ? ` ${r.status}` : ""}`);
  const raw: RawEvent[] =
    s.format === "ical" ? eventsFromIcal(r.body, r.url) : eventsFromJsonLd(r.body, r.url);
  const now = Date.now();
  const upcoming = raw.filter(
    (e) => (e.endsAt ?? e.startsAt).getTime() >= now - 86_400_000 && e.startsAt.getTime() <= now + HORIZON_MS,
  );
  for (const e of upcoming) {
    const other = sameEvent(seen, e.title, e.startsAt);
    if (other && other !== s.key) continue;
    remember(seen, e.title, e.startsAt, s.key);
    const m = scoreEvent({
      title: e.title,
      text: e.description,
      organiser: e.organiser,
      place: e.place,
      online: e.online,
    });
    const values = {
      title: e.title,
      organiser: e.organiser ?? (s.kind === "watch" ? s.name : null),
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
      place: e.place,
      online: e.online,
      url: e.url,
      description: e.description,
      price: e.price,
      score: m.score,
      reasons: m.reasons,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    };
    const res = await db()
      .insert(events)
      .values({ source: s.key, externalId: e.externalId, ...values })
      .onConflictDoUpdate({ target: [events.source, events.externalId], set: values })
      .returning({ inserted: sql<boolean>`xmax = 0` });
    if (res[0]?.inserted) report.added++;
    else report.updated++;
  }

  const patch: Partial<typeof eventSources.$inferInsert> = {
    lastCheckedAt: new Date(),
    lastStatus: "ok",
    lastError: null,
    eventsFound: upcoming.length,
    updatedAt: new Date(),
  };
  if (s.kind === "watch") {
    const lines = datedLines(r.body);
    const hash = createHash("sha256")
      .update([...lines].sort().join("\n"))
      .digest("hex");
    patch.lines = lines;
    patch.linesHash = hash;
    if (prevLines) {
      const before = new Set(prevLines);
      const added = lines.filter((l) => !before.has(l));
      if (added.length) {
        patch.newLines = added.slice(0, 8);
        patch.changedAt = new Date();
        report.changedPages.push(s.key);
      }
    }
  }
  await db().update(eventSources).set(patch).where(eq(eventSources.key, s.key));
}

/** Clears the "new" mark of a watched page once the owner has opened it. */
export async function markSourceSeen(key: string) {
  await db()
    .update(eventSources)
    .set({ seenAt: new Date(), updatedAt: new Date() })
    .where(and(eq(eventSources.key, key)));
}
