/**
 * Job offers published as schema.org "JobPosting" data on a company's own career pages: the
 * machine-readable format career sites add for Google's job search. Untrusted input: every field is
 * checked, and only text is kept.
 */
import * as cheerio from "cheerio";
import type { RawJob } from "./sources.ts";
import { clean, htmlToText, toDate } from "./text.ts";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

function isJobPosting(o: Obj): boolean {
  return arr(o["@type"]).some((t) => str(t).toLowerCase() === "jobposting");
}

/** All JobPosting objects on a page (top level, @graph, ItemList elements, nested arrays). */
export function jobPostingsIn(html: string): Obj[] {
  const $ = cheerio.load(html);
  const out: Obj[] = [];
  const visit = (v: unknown, depth: number) => {
    if (depth > 5) return;
    if (Array.isArray(v)) {
      for (const x of v) visit(x, depth + 1);
      return;
    }
    const o = obj(v);
    if (!Object.keys(o).length) return;
    if (isJobPosting(o)) {
      out.push(o);
      return;
    }
    visit(o["@graph"], depth + 1);
    for (const el of arr(o.itemListElement)) visit(obj(el).item ?? el, depth + 1);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      visit(JSON.parse(raw), 0);
    } catch {
      // Some sites put several objects or trailing commas in one block; skip what does not parse.
    }
  });
  return out.slice(0, 200);
}

function place(p: Obj): string {
  const a = obj(p.address);
  const country = typeof a.addressCountry === "string" ? a.addressCountry : str(obj(a.addressCountry).name);
  return [clean(a.addressLocality), clean(a.addressRegion), clean(country)].filter(Boolean).join(", ");
}

export function toRawJob(o: Obj, pageUrl: string, companyName: string): RawJob | null {
  // Some sites put HTML entities ("&amp;") inside the JSON values.
  const title = clean(htmlToText(str(o.title) || str(o.name)));
  if (!title) return null;
  const places = arr(o.jobLocation)
    .map((p) => place(obj(p)))
    .filter(Boolean);
  const remote = str(o.jobLocationType).toUpperCase() === "TELECOMMUTE";
  const applicant = arr(o.applicantLocationRequirements)
    .map((r) => clean(obj(r).name))
    .filter(Boolean);
  const location = [
    ...places,
    ...(remote ? [`Remote${applicant.length ? ` (${applicant.join(", ")})` : ""}`] : []),
  ].join("; ");
  const id = clean(obj(o.identifier).value) || clean(o.identifier) || clean(o.url) || pageUrl;
  const url = clean(o.url) && /^https?:\/\//.test(clean(o.url)) ? clean(o.url) : pageUrl;
  return {
    externalId: id.slice(0, 300),
    title,
    companyName: clean(htmlToText(str(obj(o.hiringOrganization).name))) || companyName,
    location: location || null,
    workplace: remote ? "remote" : "unknown",
    employmentType: arr(o.employmentType).map(str).filter(Boolean).join(", ") || null,
    description: htmlToText(str(o.description)),
    url,
    postedAt: toDate(o.datePosted),
  };
}

const JOB_PATH =
  /\/(jobs?|oferta|oferty|oferty-pracy|offers?|positions?|vacanc(y|ies)|stellen|stellenangebote|careers?\/job|kariera\/oferta|praca|requisitions?|openings?|job-details?|jobdetails)(\/|-|$|\?)/i;
const SKIP =
  /linkedin|facebook|instagram|twitter|youtube|pracuj\.pl|\.pdf($|\?)|login|signin|rejestracja|register|mailto:|\?page=|[?&](sort|filter|lang)=/i;

/** Links on a careers page that look like single job offers, with their visible text. */
export function jobLinks(html: string, base: string): { url: string; text: string }[] {
  const $ = cheerio.load(html);
  const baseHost = new URL(base).hostname.replace(/^www\./, "");
  const root = baseHost.split(".").slice(-2).join(".");
  const seen = new Map<string, string>();
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    let u: URL;
    try {
      u = new URL(href, base);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol) || SKIP.test(u.toString())) return;
    const host = u.hostname.replace(/^www\./, "");
    if (!(host === baseHost || host.endsWith(`.${root}`) || host === root)) return;
    if (!JOB_PATH.test(u.pathname + u.search)) return;
    // A single offer has an id or a long slug after the job path, not just "/jobs".
    if (!/(\d{3,}|[a-z]{3,}-[a-z]{3,}-[a-z0-9-]{3,})/i.test(u.pathname)) return;
    const key = u.toString().split("#")[0]!;
    if (key === base) return;
    const text = $(a).text().replace(/\s+/g, " ").trim().slice(0, 140);
    if (!seen.has(key) || (text.length > (seen.get(key) ?? "").length && text.length < 140))
      seen.set(key, text);
  });
  return [...seen.entries()].map(([url, text]) => ({ url, text })).slice(0, 150);
}
