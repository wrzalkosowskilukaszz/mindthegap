/**
 * Event formats that sites publish for machines: schema.org Event data inside pages (what search engines
 * read) and iCalendar feeds (.ics). Untrusted input: every field is checked and only text is kept.
 */
import * as cheerio from "cheerio";
import { DateTime } from "luxon";
import { clean, htmlToText } from "../careers/text.ts";

export type RawEvent = {
  externalId: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  url: string;
  place: string | null;
  online: boolean;
  organiser: string | null;
  description: string;
  price: string | null;
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

const EVENT_TYPES =
  /^(event|businessevent|educationevent|socialevent|exhibitionevent|festival|childrensevent|literaryevent|saleevent|screeningevent|eventseries)$/i;

function isEvent(o: Obj): boolean {
  return arr(o["@type"]).some((t) => EVENT_TYPES.test(str(t)));
}

/** A date from schema.org or a feed; times without an offset are Polish time. */
export function eventDate(v: unknown): Date | null {
  const s = str(v).trim();
  if (!s) return null;
  const iso = DateTime.fromISO(s, { zone: "Europe/Warsaw" });
  if (iso.isValid) return iso.toJSDate();
  const sqlish = DateTime.fromSQL(s, { zone: "Europe/Warsaw" });
  return sqlish.isValid ? sqlish.toJSDate() : null;
}

function placeOf(loc: unknown): { place: string | null; online: boolean } {
  let online = false;
  const parts: string[] = [];
  for (const l of arr(loc)) {
    if (typeof l === "string") {
      if (/^https?:\/\//.test(l)) online = true;
      else if (clean(l)) parts.push(clean(l));
      continue;
    }
    const o = obj(l);
    const type = arr(o["@type"]).map(str).join(" ");
    if (/virtuallocation/i.test(type)) {
      online = true;
      continue;
    }
    const a = obj(o.address);
    const city = clean(str(a.addressLocality)) || (typeof o.address === "string" ? clean(o.address) : "");
    const name = clean(htmlToText(str(o.name)));
    const bit = [name, city].filter(Boolean).join(", ");
    if (bit) parts.push(bit);
  }
  return { place: parts.join("; ").slice(0, 300) || null, online };
}

export function eventsFromJsonLd(html: string, pageUrl: string): RawEvent[] {
  const $ = cheerio.load(html);
  const found: Obj[] = [];
  const visit = (v: unknown, depth: number) => {
    if (depth > 5 || found.length > 300) return;
    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
      return;
    }
    const o = obj(v);
    if (!Object.keys(o).length) return;
    if (isEvent(o)) found.push(o);
    visit(o["@graph"], depth + 1);
    visit(o.subEvent, depth + 1);
    for (const el of arr(o.itemListElement)) visit(obj(el).item ?? el, depth + 1);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      visit(JSON.parse($(el).text().trim()), 0);
    } catch {
      // A broken block is skipped.
    }
  });
  const out: RawEvent[] = [];
  for (const o of found) {
    const title = clean(htmlToText(str(o.name)));
    const startsAt = eventDate(o.startDate);
    if (!title || !startsAt) continue;
    const { place, online } = placeOf(o.location);
    const mode = str(o.eventAttendanceMode);
    const rawUrl = clean(str(o.url));
    const url = /^https?:\/\//.test(rawUrl) ? rawUrl : pageUrl;
    const offers = arr(o.offers).map(obj);
    const price =
      offers
        .map((x) => {
          const p = str(x.price);
          return p === "0" || p === "0.00" ? "bezpłatne" : p ? `${p} ${str(x.priceCurrency)}`.trim() : "";
        })
        .filter(Boolean)
        .join(" / ") || null;
    out.push({
      externalId: (url !== pageUrl ? url : `${pageUrl}#${title}|${startsAt.toISOString()}`).slice(0, 400),
      title: title.slice(0, 300),
      startsAt,
      endsAt: eventDate(o.endDate),
      url,
      place,
      online: online || /online/i.test(mode),
      organiser: clean(htmlToText(str(obj(arr(o.organizer)[0]).name))) || null,
      description: htmlToText(str(o.description)).slice(0, 8000),
      price,
    });
  }
  return out;
}

/** iCalendar text value: unescape \n, \, and \; */
const icalText = (s: string) =>
  s
    .replace(/\\n/gi, "\n")
    .replace(/\\([,;\\])/g, "$1")
    .trim();

function icalDate(value: string, params: string): Date | null {
  const tz = /TZID=([^;:]+)/i.exec(params)?.[1] ?? "Europe/Warsaw";
  if (/^\d{8}$/.test(value)) {
    const d = DateTime.fromFormat(value, "yyyyMMdd", { zone: "Europe/Warsaw" });
    return d.isValid ? d.toJSDate() : null;
  }
  const m = /^(\d{8}T\d{6})(Z)?$/.exec(value);
  if (!m) return null;
  const d = DateTime.fromFormat(m[1]!, "yyyyMMdd'T'HHmmss", { zone: m[2] ? "UTC" : tz });
  return d.isValid ? d.toJSDate() : null;
}

export function eventsFromIcal(text: string, feedUrl: string): RawEvent[] {
  // Unfold continuation lines (a line starting with a space or tab continues the previous one).
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
  const out: RawEvent[] = [];
  let cur: Record<string, { value: string; params: string }> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      const title = clean(icalText(cur.SUMMARY?.value ?? ""));
      const startsAt = cur.DTSTART ? icalDate(cur.DTSTART.value, cur.DTSTART.params) : null;
      if (title && startsAt) {
        const loc = clean(icalText(cur.LOCATION?.value ?? ""));
        const url = clean(cur.URL?.value ?? "");
        const desc = icalText(cur.DESCRIPTION?.value ?? "");
        out.push({
          externalId: (cur.UID?.value || `${feedUrl}#${title}|${startsAt.toISOString()}`).slice(0, 400),
          title: title.slice(0, 300),
          startsAt,
          endsAt: cur.DTEND ? icalDate(cur.DTEND.value, cur.DTEND.params) : null,
          url: /^https?:\/\//.test(url) ? url : feedUrl,
          place: loc && !/^https?:\/\//.test(loc) ? loc.slice(0, 300) : null,
          online: /online|zoom|teams|webinar|^https?:\/\//i.test(loc),
          organiser:
            clean(icalText(/CN=("?)([^;:"]+)\1/i.exec(cur.ORGANIZER?.params ?? "")?.[2] ?? "")) || null,
          description: htmlToText(desc).slice(0, 8000),
          price: null,
        });
      }
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i <= 0) continue;
      const [name = "", ...params] = line.slice(0, i).split(";");
      cur[name.toUpperCase()] = { value: line.slice(i + 1), params: params.join(";") };
    }
    if (out.length >= 500) break;
  }
  return out;
}
