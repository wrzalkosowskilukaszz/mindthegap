/**
 * Does the offer's link still open a live posting? Job feeds (Adzuna, Jooble, careers pages) keep
 * listing ads after the employer has taken them down, so clicking one lands on "this job has expired"
 * or a 404. Each open offer's link is opened once in a while (same polite fetcher: robots.txt and
 * per-host pacing) and offers whose page is gone or says the ad has ended are closed.
 *
 * Only clear signs count as dead: 404/410, a redirect from the ad to a home, search or error page, or an
 * "expired / no longer available" message in the visible text. Anything else (blocked, timeouts, pages
 * built by scripts) is "unknown" and the offer stays.
 */
import { and, desc, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { jobOffers, jobSources } from "../db/schema.ts";
import type { FetchOutcome, PoliteFetcher } from "../discovery/fetcher.ts";
import { htmlToText } from "./text.ts";

export type LinkVerdict = { status: "alive" | "dead" | "unknown"; reason: string };

// Phrases job boards show on ads that have ended (EN, PL, DE). Matched on visible text only.
const EXPIRED = [
  /\b(this|the) (job|position|role|vacancy|posting|job posting|job ad|listing|offer)( (ad|posting|listing))? (is|has) (no longer|not) (available|active|open|accepting)/,
  /\b(job|position|vacancy|posting|listing|offer) (is )?no longer (available|active|open|exists)/,
  /\bno longer accepting applications\b/,
  /\b(this|the) (job|position|vacancy|role|posting|job posting|job ad|listing) (has )?(expired|been filled|been closed|been removed|closed)\b/,
  /\b(job|posting|vacancy|position) (has )?expired\b/,
  /\bthe (job|page|position) you('| a)re looking for (is no longer|no longer|does not|doesn't|could not|cannot|can't|has been)/,
  /\b(job|position|vacancy|posting) not found\b/,
  /\bapplications? (for this (job|position|role) )?(is|are|has been|have been) closed\b/,
  /\boferta (pracy )?(wygas[łl]a|jest (ju[żz] )?nieaktualna|nie jest ju[żz] (aktualna|dost[eę]pna)|zosta[łl]a (zako[nń]czona|zamkni[eę]ta|usuni[eę]ta))/,
  /\bog[łl]oszenie (wygas[łl]o|jest (ju[żz] )?nieaktualne|nie jest ju[żz] (aktualne|dost[eę]pne)|zosta[łl]o (zako[nń]czone|usuni[eę]te))/,
  /\brekrutacja (zosta[łl]a )?zako[nń]czon[ao]\b/,
  /\bnie (znaleziono|ma ju[żz]) (tej )?oferty\b/,
  /\b(diese )?stelle(nanzeige)? (ist )?(nicht mehr (verf[üu]gbar|aktiv|online)|bereits besetzt|wurde besetzt)/,
];
// A page that is nothing but an error (soft 404): only when the page is short.
const SOFT_404 =
  /\b(page not found|404|nie znaleziono strony|strona nie (istnieje|zosta[łl]a znaleziona)|seite nicht gefunden)\b/;

const LANDING =
  /^\/?((pl|en|de|en-us|en-gb|pl-pl)\/?)?((jobs?|careers?|kariera|praca|oferty(-pracy)?|search|szukaj|vacancies|stellenangebote|job-search|404|error|not-?found|expired)\/?)?$/i;
const ERROR_URL = /(expired|not-?found|notfound|job-?closed|no-?longer|404|error=|errorcode|invalid)/i;

/** Pure verdict from one fetch of the offer's link (kept separate so it can be tested). */
export function judgeLink(requested: string, outcome: FetchOutcome): LinkVerdict {
  if (!outcome.ok) {
    if (outcome.reason === "http_error" && (outcome.status === 404 || outcome.status === 410))
      return { status: "dead", reason: `HTTP ${outcome.status}` };
    return { status: "unknown", reason: `${outcome.reason}${outcome.status ? ` ${outcome.status}` : ""}` };
  }
  let from: URL;
  let to: URL;
  try {
    from = new URL(requested);
    to = new URL(outcome.url);
  } catch {
    return { status: "unknown", reason: "bad url" };
  }
  const moved = from.toString() !== to.toString();
  if (
    moved &&
    ERROR_URL.test(`${to.pathname}${to.search}`) &&
    !ERROR_URL.test(`${from.pathname}${from.search}`)
  )
    return { status: "dead", reason: "redirected to an error page" };
  // A deep link to one ad that now lands on the home page or the general job list.
  if (moved && from.pathname.split("/").filter(Boolean).length >= 1 && LANDING.test(to.pathname)) {
    const sameAd = from.pathname.replace(/\/+$/, "") === to.pathname.replace(/\/+$/, "");
    if (!sameAd && !to.search) return { status: "dead", reason: "redirected to the job list" };
  }
  const text = htmlToText(outcome.body.slice(0, 1_500_000)).toLowerCase().replace(/\s+/g, " ");
  // Look at the top of the page, where boards put the notice (and not at "similar jobs" lists).
  const top = text.slice(0, 4000);
  const hit = EXPIRED.find((re) => re.test(top));
  if (hit) return { status: "dead", reason: "page says the ad has ended" };
  if (text.length < 1500 && SOFT_404.test(text)) return { status: "dead", reason: "page not found" };
  return { status: "alive", reason: "ok" };
}

const RECHECK_ALIVE_MS = 2 * 86_400_000;

/** Opens one offer's link and records the verdict; a dead new offer leaves the lists. */
export async function verifyOfferLink(
  fetcher: PoliteFetcher,
  offer: { id: string; url: string; status: string; sourceKind?: string | null },
): Promise<LinkVerdict> {
  let verdict: LinkVerdict;
  try {
    verdict = judgeLink(offer.url, await fetcher.get(offer.url, "html"));
  } catch (e) {
    verdict = { status: "unknown", reason: e instanceof Error ? e.message : String(e) };
  }
  // Saved or applied offers stay where the owner put them; they only get the "ended" mark.
  // Hand-added offers only get the mark too.
  const close = verdict.status === "dead" && offer.status === "new" && offer.sourceKind !== "manual";
  await db()
    .update(jobOffers)
    .set({
      linkStatus: verdict.status,
      linkCheckedAt: new Date(),
      ...(close ? { closedAt: new Date(), updatedAt: new Date() } : {}),
    })
    .where(eq(jobOffers.id, offer.id));
  return verdict;
}

/**
 * Checks the links of open offers that were never checked or not for two days, best matches first,
 * until the deadline. Hand-added offers are left alone. Returns how many were checked and closed.
 */
function linkCheckDue() {
  return and(
    isNull(jobOffers.closedAt),
    sql`${jobOffers.status} in ('new','saved')`,
    ne(jobSources.kind, "manual"),
    or(isNull(jobOffers.linkCheckedAt), lt(jobOffers.linkCheckedAt, new Date(Date.now() - RECHECK_ALIVE_MS))),
  );
}

/** True when some open offer's link has not been checked lately. */
export async function linksDue(): Promise<boolean> {
  const [r] = await db()
    .select({ id: jobOffers.id })
    .from(jobOffers)
    .innerJoin(jobSources, eq(jobSources.id, jobOffers.sourceId))
    .where(linkCheckDue())
    .limit(1);
  return Boolean(r);
}

export async function checkOfferLinks(
  fetcher: PoliteFetcher,
  until: number,
  max = 60,
): Promise<{ checked: number; dead: number }> {
  const rows = await db()
    .select({ id: jobOffers.id, url: jobOffers.url, status: jobOffers.status })
    .from(jobOffers)
    .innerJoin(jobSources, eq(jobSources.id, jobOffers.sourceId))
    .where(linkCheckDue())
    .orderBy(sql`${jobOffers.linkCheckedAt} asc nulls first`, desc(jobOffers.score))
    .limit(max);
  let checked = 0;
  let dead = 0;
  // One worker per host at a time (the fetcher keeps each host's pace); different hosts in parallel.
  const byHost = new Map<string, typeof rows>();
  for (const r of rows) {
    let host = "";
    try {
      host = new URL(r.url).host;
    } catch {
      continue;
    }
    byHost.set(host, [...(byHost.get(host) ?? []), r]);
  }
  const hosts = [...byHost.values()];
  const worker = async () => {
    for (let group = hosts.shift(); group; group = hosts.shift()) {
      for (const o of group) {
        if (Date.now() >= until) return;
        const v = await verifyOfferLink(fetcher, o);
        checked++;
        if (v.status === "dead") dead++;
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { checked, dead };
}
