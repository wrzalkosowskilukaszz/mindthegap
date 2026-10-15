/**
 * Readers for public job feeds. Each returns plain jobs; nothing here decides relevance.
 *
 * Company job boards use the public APIs the job-board vendors publish for career sites (Greenhouse
 * Job Board API, Lever Postings API, Ashby Posting API, SmartRecruiters Posting API, Workable widget,
 * Recruitee careers API, Personio XML feed, Teamtailor RSS, Eightfold careers API). Aggregators:
 * Arbeitnow and Himalayas (free public APIs), Adzuna and Jooble (free keys). Every request goes through
 * the polite fetcher (robots.txt, per-host delays) except the two keyed APIs, which are called as their
 * terms describe. Responses are untrusted: every field is checked before use.
 */
import type { PoliteFetcher } from "../discovery/fetcher.ts";
import { env } from "../env.ts";
import { httpFetch } from "../providers/http.ts";
import { careerLinks } from "./detect.ts";
import { jobLinks, jobPostingsIn, toRawJob } from "./jsonld.ts";
import { clean, htmlToText, toDate } from "./text.ts";

export type RawJob = {
  externalId: string;
  title: string;
  companyName: string;
  location: string | null;
  countries?: string[];
  workplace?: "remote" | "hybrid" | "onsite" | "unknown";
  employmentType?: string | null;
  department?: string | null;
  description: string;
  url: string;
  postedAt: Date | null;
};

export type SourceRef = { kind: string; token: string; name: string; url?: string | null };
export type Fetched = { jobs: RawJob[]; complete: boolean; total: number };
/** Asked before an extra request for a job's full text (only promising titles get one). */
export type WantDetail = (title: string, location: string) => boolean;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const MAX_JOBS = 600;

async function getJson(f: PoliteFetcher, url: string): Promise<unknown> {
  const r = await f.get(url, "json");
  if (!r.ok)
    throw new SourceError(
      r.reason === "robots_disallowed" ? "robots" : "http",
      `${r.reason} ${r.status ?? ""}`.trim(),
    );
  try {
    return JSON.parse(r.body);
  } catch {
    throw new SourceError("format", "not JSON");
  }
}

async function getXml(f: PoliteFetcher, url: string): Promise<string> {
  const r = await f.get(url, "xml");
  if (!r.ok)
    throw new SourceError(
      r.reason === "robots_disallowed" ? "robots" : "http",
      `${r.reason} ${r.status ?? ""}`.trim(),
    );
  return r.body;
}

export class SourceError extends Error {
  constructor(
    readonly kind: "robots" | "http" | "format" | "config",
    message: string,
  ) {
    super(message);
  }
}

const workplaceOf = (s: string): RawJob["workplace"] =>
  /remote|zdaln/i.test(s)
    ? "remote"
    : /hybrid|hybryd/i.test(s)
      ? "hybrid"
      : /on-?site|office|stacjonar/i.test(s)
        ? "onsite"
        : "unknown";

// ------------------------------------------------------------------------------------------------
// Company job boards
// ------------------------------------------------------------------------------------------------

async function greenhouse(f: PoliteFetcher, s: SourceRef): Promise<Fetched> {
  const d = obj(
    await getJson(
      f,
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(s.token)}/jobs?content=true`,
    ),
  );
  const list = arr(d.jobs);
  const jobs = list.slice(0, MAX_JOBS).map((x): RawJob => {
    const j = obj(x);
    const loc = clean(obj(j.location).name);
    return {
      externalId: str(j.id),
      title: clean(j.title),
      companyName: clean(j.company_name) || s.name,
      location: loc || null,
      workplace: workplaceOf(loc),
      department: clean(obj(arr(j.departments)[0]).name) || null,
      description: htmlToText(str(j.content)),
      url: str(j.absolute_url),
      postedAt: toDate(j.first_published ?? j.updated_at),
    };
  });
  return { jobs, complete: list.length <= MAX_JOBS, total: list.length };
}

async function lever(f: PoliteFetcher, s: SourceRef): Promise<Fetched> {
  let d: unknown;
  try {
    d = await getJson(f, `https://api.lever.co/v0/postings/${encodeURIComponent(s.token)}?mode=json`);
  } catch {
    d = await getJson(f, `https://api.eu.lever.co/v0/postings/${encodeURIComponent(s.token)}?mode=json`);
  }
  const list = arr(d);
  const jobs = list.slice(0, MAX_JOBS).map((x): RawJob => {
    const j = obj(x);
    const c = obj(j.categories);
    const loc = clean(c.location) || arr(c.allLocations).map(str).join(", ");
    const lists = arr(j.lists)
      .map((l) => `${clean(obj(l).text)}\n${htmlToText(str(obj(l).content))}`)
      .join("\n\n");
    return {
      externalId: str(j.id),
      title: clean(j.text),
      companyName: s.name,
      location: loc || null,
      countries: str(j.country) ? [str(j.country)] : undefined,
      workplace: workplaceOf(`${str(j.workplaceType)} ${loc}`),
      employmentType: clean(c.commitment) || null,
      department: clean(c.team) || clean(c.department) || null,
      description: `${str(j.descriptionPlain)}\n\n${lists}\n\n${str(j.additionalPlain)}`
        .trim()
        .slice(0, 20_000),
      url: str(j.hostedUrl),
      postedAt: toDate(Number(j.createdAt)),
    };
  });
  return { jobs, complete: list.length <= MAX_JOBS, total: list.length };
}

async function ashby(f: PoliteFetcher, s: SourceRef): Promise<Fetched> {
  const d = obj(
    await getJson(f, `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(s.token)}`),
  );
  const list = arr(d.jobs).filter((x) => obj(x).isListed !== false);
  const jobs = list.slice(0, MAX_JOBS).map((x): RawJob => {
    const j = obj(x);
    const loc = [clean(j.location), ...arr(j.secondaryLocations).map((l) => clean(obj(l).location))]
      .filter(Boolean)
      .join(", ");
    return {
      externalId: str(j.id),
      title: clean(j.title),
      companyName: s.name,
      location: loc || null,
      workplace: j.isRemote === true ? "remote" : workplaceOf(str(j.workplaceType)),
      employmentType: clean(j.employmentType) || null,
      department: clean(j.department) || null,
      description: str(j.descriptionPlain).slice(0, 20_000) || htmlToText(str(j.descriptionHtml)),
      url: str(j.jobUrl),
      postedAt: toDate(j.publishedAt),
    };
  });
  return { jobs, complete: list.length <= MAX_JOBS, total: list.length };
}

async function smartrecruiters(f: PoliteFetcher, s: SourceRef, want: WantDetail): Promise<Fetched> {
  const base = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(s.token)}/postings`;
  const out: RawJob[] = [];
  let total = 0;
  for (let offset = 0; offset < MAX_JOBS; offset += 100) {
    const d = obj(await getJson(f, `${base}?limit=100&offset=${offset}`));
    total = Number(d.totalFound) || total;
    const page = arr(d.content);
    for (const x of page) {
      const j = obj(x);
      const l = obj(j.location);
      const loc = [clean(l.city), clean(l.region), str(l.country).toUpperCase()].filter(Boolean).join(", ");
      const title = clean(j.name);
      let description = "";
      if (want(title, `${loc} ${l.remote === true ? "remote" : ""}`)) {
        try {
          const det = obj(await getJson(f, `${base}/${encodeURIComponent(str(j.id))}`));
          const sec = obj(obj(det.jobAd).sections);
          description = ["companyDescription", "jobDescription", "qualifications", "additionalInformation"]
            .map((k) => htmlToText(str(obj(sec[k]).text)))
            .filter(Boolean)
            .join("\n\n");
        } catch {
          /* the list entry is still useful without the full text */
        }
      }
      out.push({
        externalId: str(j.id),
        title,
        companyName: clean(obj(j.company).name) || s.name,
        location: loc || null,
        countries: str(l.country) ? [str(l.country).toUpperCase()] : undefined,
        workplace: l.remote === true ? "remote" : l.hybrid === true ? "hybrid" : "unknown",
        employmentType: clean(obj(j.typeOfEmployment).label) || null,
        department: clean(obj(j.department).label) || clean(obj(j.function).label) || null,
        description,
        url: `https://jobs.smartrecruiters.com/${encodeURIComponent(s.token)}/${encodeURIComponent(str(j.id))}`,
        postedAt: toDate(j.releasedDate),
      });
    }
    if (page.length < 100) break;
  }
  return { jobs: out, complete: out.length >= total, total };
}

async function workable(f: PoliteFetcher, s: SourceRef): Promise<Fetched> {
  const d = obj(
    await getJson(
      f,
      `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(s.token)}?details=true`,
    ),
  );
  const list = arr(d.jobs);
  const jobs = list.slice(0, MAX_JOBS).map((x): RawJob => {
    const j = obj(x);
    const loc = [clean(j.city), clean(j.state), clean(j.country)].filter(Boolean).join(", ");
    return {
      externalId: str(j.shortcode) || str(j.id),
      title: clean(j.title),
      companyName: clean(d.name) || s.name,
      location: loc || null,
      workplace: j.telecommuting === true ? "remote" : "unknown",
      employmentType: clean(j.employment_type) || null,
      department: clean(j.department) || null,
      description: htmlToText(str(j.description)),
      url: str(j.url) || str(j.shortlink),
      postedAt: toDate(j.published_on ?? j.created_at),
    };
  });
  return { jobs, complete: list.length <= MAX_JOBS, total: list.length };
}

async function recruitee(f: PoliteFetcher, s: SourceRef): Promise<Fetched> {
  const d = obj(await getJson(f, `https://${s.token}.recruitee.com/api/offers/`));
  const list = arr(d.offers);
  const jobs = list.slice(0, MAX_JOBS).map((x): RawJob => {
    const j = obj(x);
    const loc = clean(j.location) || [clean(j.city), clean(j.country)].filter(Boolean).join(", ");
    return {
      externalId: str(j.id),
      title: clean(j.title),
      companyName: clean(j.company_name) || s.name,
      location: loc || null,
      countries: str(j.country_code) ? [str(j.country_code).toUpperCase()] : undefined,
      workplace:
        j.remote === true
          ? "remote"
          : j.hybrid === true
            ? "hybrid"
            : j.on_site === true
              ? "onsite"
              : "unknown",
      employmentType: clean(j.employment_type_code) || null,
      department: clean(j.department) || null,
      description: `${htmlToText(str(j.description))}\n\n${htmlToText(str(j.requirements))}`.trim(),
      url: str(j.careers_url),
      postedAt: toDate(j.published_at ?? j.created_at),
    };
  });
  return { jobs, complete: list.length <= MAX_JOBS, total: list.length };
}

/** Tiny tolerant XML helpers for two known feed formats (Personio XML, RSS). */
function tags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  return [...xml.matchAll(re)].map((m) => m[1] ?? "");
}
function tag(xml: string, t: string): string {
  const v = tags(xml, t)[0] ?? "";
  return v.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
}

async function personio(f: PoliteFetcher, s: SourceRef): Promise<Fetched> {
  const host = s.token.includes(".") ? s.token : `${s.token}.jobs.personio.de`;
  const xml = await getXml(f, `https://${host}/xml?language=en`);
  const list = tags(xml, "position");
  const jobs = list.slice(0, MAX_JOBS).map((p): RawJob => {
    const id = tag(p, "id");
    const desc = tags(p, "jobDescription")
      .map((d) => `${tag(d, "name")}\n${htmlToText(tag(d, "value"))}`)
      .join("\n\n");
    const office = [tag(p, "office"), ...tags(p, "additionalOffice")].filter(Boolean).join(", ");
    return {
      externalId: id,
      title: clean(tag(p, "name")),
      companyName: clean(tag(p, "subcompany")) || s.name,
      location: office || null,
      employmentType: [tag(p, "employmentType"), tag(p, "schedule")].filter(Boolean).join(", ") || null,
      department: tag(p, "department") || null,
      description: desc.slice(0, 20_000),
      url: `https://${host}/job/${id}`,
      postedAt: toDate(tag(p, "createdAt")),
    };
  });
  return { jobs, complete: true, total: list.length };
}

async function teamtailor(f: PoliteFetcher, s: SourceRef): Promise<Fetched> {
  const host = s.token.includes(".") ? s.token : `${s.token}.teamtailor.com`;
  const xml = await getXml(f, `https://${host}/jobs.rss`);
  const items = tags(xml, "item");
  const jobs = items.slice(0, MAX_JOBS).map((it): RawJob => {
    const link = tag(it, "link");
    const loc = [
      tag(it, "tt:city"),
      tag(it, "tt:country"),
      tags(it, "tt:location")
        .map((l) => tag(l, "tt:city"))
        .join(", "),
    ]
      .filter(Boolean)
      .join(", ");
    return {
      externalId: tag(it, "guid") || link,
      title: clean(tag(it, "title")),
      companyName: s.name,
      location: loc || null,
      workplace: workplaceOf(tag(it, "remoteStatus") || tag(it, "tt:remoteStatus")),
      department: tag(it, "tt:department") || null,
      description: htmlToText(tag(it, "description")),
      url: link,
      postedAt: toDate(tag(it, "pubDate")),
    };
  });
  return { jobs, complete: true, total: items.length };
}

/**
 * Eightfold career sites (Netflix): token "host|domain". The list returns ten jobs at a time and has
 * no text, so it is searched country by country (Europe only) and details are read on demand.
 */
const EUROPE_SEARCH = [
  "Poland",
  "Netherlands",
  "Spain",
  "France",
  "Germany",
  "Italy",
  "Sweden",
  "Belgium",
  "Ireland",
  "Remote",
];
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function eightfold(f: PoliteFetcher, s: SourceRef, want: WantDetail): Promise<Fetched> {
  const [host, domain] = s.token.split("|");
  if (!host || !domain) throw new SourceError("config", "token must be host|domain");
  const out = new Map<string, RawJob>();
  let total = 0;
  let complete = true;
  // Start from a different country each time, so a rate limit never hides the same countries.
  const shift = Math.floor(Date.now() / 3_600_000) % EUROPE_SEARCH.length;
  const order = [...EUROPE_SEARCH.slice(shift), ...EUROPE_SEARCH.slice(0, shift)];
  search: for (const place of order) {
    for (let start = 0; start < 120; start += 10) {
      await pause(1500); // this site rate-limits quickly; stay well under it
      let d: Obj;
      try {
        d = obj(
          await getJson(
            f,
            `https://${host}/api/apply/v2/jobs?domain=${encodeURIComponent(domain)}&location=${encodeURIComponent(place)}&start=${start}&num=10`,
          ),
        );
      } catch (e) {
        if (out.size === 0) throw e;
        complete = false; // keep what we have; never close offers after a partial read
        break search;
      }
      const count = Number(d.count) || 0;
      if (start === 0) total += count;
      const page = arr(d.positions);
      for (const x of page) {
        const j = obj(x);
        const id = str(j.id);
        if (!id || out.has(id)) continue;
        const loc = arr(j.locations).map(str).join("; ") || clean(j.location);
        const title = clean(j.name);
        let description = htmlToText(str(j.job_description));
        if (!description && want(title, `${loc} ${str(j.work_location_option)}`)) {
          try {
            await pause(1500);
            const det = obj(
              await getJson(
                f,
                `https://${host}/api/apply/v2/jobs/${encodeURIComponent(id)}?domain=${encodeURIComponent(domain)}`,
              ),
            );
            description = htmlToText(str(det.job_description));
          } catch {
            /* keep the entry without text */
          }
        }
        out.set(id, {
          externalId: id,
          title,
          companyName: s.name,
          location: loc || null,
          workplace: workplaceOf(str(j.work_location_option)),
          department: clean(j.department) || null,
          description,
          url: str(j.canonicalPositionUrl) || `https://${host}/careers/job/${id}`,
          postedAt: toDate(Number(j.t_create)),
        });
      }
      if (start + 10 >= count || page.length === 0) break;
    }
  }
  return { jobs: [...out.values()], complete, total };
}

/**
 * Workday career sites: token "tenant|wdN|site". The public search the career site itself uses,
 * once per topic; full text only for promising titles.
 */
function workdayPosted(s: string): Date | null {
  const t = s.toLowerCase();
  if (/today|dzisiaj/.test(t)) return new Date();
  if (/yesterday|wczoraj/.test(t)) return new Date(Date.now() - 86_400_000);
  const m = t.match(/(\d+)\+?\s*(day|dni)/);
  return m ? new Date(Date.now() - Number(m[1]) * 86_400_000) : null;
}
async function workday(f: PoliteFetcher, s: SourceRef, want: WantDetail): Promise<Fetched> {
  const [tenant, wd, site] = s.token.split("|");
  if (!tenant || !wd || !site) throw new SourceError("config", "token must be tenant|wdN|site");
  const base = `https://${tenant}.${wd}.myworkdayjobs.com`;
  const api = `${base}/wday/cxs/${tenant}/${site}`;
  const out = new Map<string, RawJob>();
  let total = 0;
  for (const q of SEARCH_QUERIES.slice(0, 7)) {
    const r = await f.postJson(`${api}/jobs`, { appliedFacets: {}, limit: 20, offset: 0, searchText: q });
    if (!r.ok) {
      if (out.size === 0 && total === 0)
        throw new SourceError(
          r.reason === "robots_disallowed" ? "robots" : "http",
          `${r.reason} ${r.status ?? ""}`.trim(),
        );
      break;
    }
    let d: Obj;
    try {
      d = obj(JSON.parse(r.body));
    } catch {
      throw new SourceError("format", "not JSON");
    }
    total += Number(d.total) || 0;
    for (const x of arr(d.jobPostings)) {
      const j = obj(x);
      const path = str(j.externalPath);
      if (!path || out.has(path)) continue;
      const title = clean(j.title);
      let location = clean(j.locationsText);
      let description = "";
      let postedAt = workdayPosted(str(j.postedOn));
      let employmentType: string | null = null;
      if (want(title, `${location} ${path}`)) {
        const det = await f.get(`${api}${path}`, "json");
        if (det.ok) {
          try {
            const info = obj(obj(JSON.parse(det.body)).jobPostingInfo);
            description = htmlToText(str(info.jobDescription));
            location =
              [clean(info.location), ...arr(info.additionalLocations).map(clean)]
                .filter(Boolean)
                .join("; ") || location;
            postedAt = toDate(info.startDate) ?? postedAt;
            employmentType = clean(info.timeType) || null;
          } catch {
            /* keep the list entry */
          }
        }
      }
      out.set(path, {
        externalId: path,
        title,
        companyName: s.name,
        location: location || null,
        workplace: workplaceOf(`${clean(j.remoteType)} ${location}`),
        employmentType,
        description,
        url: `${base}/${site}${path}`,
        postedAt,
      });
    }
  }
  return { jobs: [...out.values()], complete: false, total };
}

/**
 * A company's own careers page without a known job system. Read only when the site publishes
 * schema.org JobPosting data: on the list page itself, or on the single-offer pages it links to.
 * First a cheap check (the page and one sample offer); then only offers whose link text looks
 * relevant are opened. Pages without such data are asked again a month later.
 */
async function careersPage(f: PoliteFetcher, s: SourceRef, want: WantDetail): Promise<Fetched> {
  const start = s.url ?? `https://${s.token}`;
  let page = await f.get(start);
  if (!page.ok)
    throw new SourceError(
      page.reason === "robots_disallowed" ? "robots" : "http",
      `${page.reason} ${page.status ?? ""}`.trim(),
    );
  const out = new Map<string, RawJob>();
  const take = (html: string, url: string) => {
    let n = 0;
    for (const o of jobPostingsIn(html)) {
      const j = toRawJob(o, url, s.name);
      if (j) {
        out.set(j.externalId, j);
        n++;
      }
    }
    return n;
  };
  take(page.body, page.url);
  let links = jobLinks(page.body, page.url);
  // The careers page is often an intro; the list of offers is one link further.
  if (!out.size && !links.length) {
    const deeper = careerLinks(page.body, page.url).find((u) => u !== page.url && u !== start);
    if (deeper) {
      const next = await f.get(deeper);
      if (next.ok) {
        page = next;
        take(page.body, page.url);
        links = jobLinks(page.body, page.url);
      }
    }
  }
  const relevant = links.filter((l) => l.text.length >= 6 && want(l.text, ""));
  let structured = out.size > 0;
  if (!structured && links.length) {
    const sample = relevant[0] ?? links[0]!;
    const r = await f.get(sample.url);
    if (r.ok) structured = take(r.body, r.url) > 0;
  }
  if (structured) {
    for (const l of relevant.slice(0, 12)) {
      if (out.size >= 60 || [...out.values()].some((j) => j.url === l.url)) continue;
      if (!want(l.text, "")) break; // also stops near the time limit
      const r = await f.get(l.url);
      if (r.ok) take(r.body, r.url);
    }
  }
  return {
    jobs: [...out.values()],
    complete: false,
    total: structured ? Math.max(out.size, links.length) : 0,
  };
}

// ------------------------------------------------------------------------------------------------
// Aggregators
// ------------------------------------------------------------------------------------------------

/** Arbeitnow: recent European (mostly German) jobs; first pages only, newest first. */
async function arbeitnow(f: PoliteFetcher, _s: SourceRef, want: WantDetail): Promise<Fetched> {
  const out: RawJob[] = [];
  let total = 0;
  for (let page = 1; page <= 5; page++) {
    const d = obj(await getJson(f, `https://www.arbeitnow.com/api/job-board-api?page=${page}`));
    const list = arr(d.data);
    total += list.length;
    for (const x of list) {
      const j = obj(x);
      const title = clean(j.title);
      const loc = clean(j.location);
      if (!want(title, `${loc} ${j.remote === true ? "remote" : ""}`)) continue;
      out.push({
        externalId: str(j.slug),
        title,
        companyName: clean(j.company_name),
        location: loc || null,
        workplace: j.remote === true ? "remote" : "unknown",
        employmentType: arr(j.job_types).map(str).join(", ") || null,
        description: htmlToText(str(j.description)),
        url: str(j.url),
        postedAt: toDate(j.created_at),
      });
    }
    if (!obj(d.links).next) break;
  }
  return { jobs: out, complete: false, total };
}

export const SEARCH_QUERIES = [
  "learning and development",
  "leadership development",
  "facilitator",
  "trainer",
  "organizational development",
  "people partner",
  "culture engagement",
  "talent development",
  "coach",
  "change management",
];

/** Himalayas: remote jobs that are open to people in Poland. */
async function himalayas(f: PoliteFetcher, _s: SourceRef, want: WantDetail): Promise<Fetched> {
  const out = new Map<string, RawJob>();
  let total = 0;
  for (const q of SEARCH_QUERIES) {
    const d = obj(
      await getJson(
        f,
        `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(q)}&country=Poland&limit=20`,
      ),
    );
    const list = arr(d.jobs);
    total += list.length;
    for (const x of list) {
      const j = obj(x);
      const title = clean(j.title);
      const countries = arr(j.locationRestrictions).map(str);
      if (!want(title, "remote")) continue;
      const id = str(j.guid) || str(j.applicationLink);
      out.set(id, {
        externalId: id,
        title,
        companyName: clean(j.companyName),
        location: countries.length
          ? `Remote (${countries.slice(0, 6).join(", ")}${countries.length > 6 ? "…" : ""})`
          : "Remote",
        countries: countries.map(countryCode).filter((c): c is string => Boolean(c)),
        workplace: "remote",
        employmentType: clean(j.employmentType) || null,
        description: htmlToText(str(j.description)),
        url: str(j.applicationLink) || id,
        postedAt: toDate(j.pubDate),
      });
    }
  }
  return { jobs: [...out.values()], complete: false, total };
}

const COUNTRY_CODES: Record<string, string> = {
  poland: "PL",
  germany: "DE",
  france: "FR",
  spain: "ES",
  italy: "IT",
  netherlands: "NL",
  belgium: "BE",
  austria: "AT",
  portugal: "PT",
  ireland: "IE",
  sweden: "SE",
  denmark: "DK",
  finland: "FI",
  czechia: "CZ",
  "czech republic": "CZ",
  slovakia: "SK",
  hungary: "HU",
  romania: "RO",
  bulgaria: "BG",
  greece: "GR",
  croatia: "HR",
  slovenia: "SI",
  estonia: "EE",
  latvia: "LV",
  lithuania: "LT",
  luxembourg: "LU",
  malta: "MT",
  cyprus: "CY",
  "united kingdom": "GB",
  "united states": "US",
  canada: "CA",
  switzerland: "CH",
  norway: "NO",
};
const countryCode = (name: string) => COUNTRY_CODES[name.trim().toLowerCase()] ?? null;

/** Adzuna (free key): Poland in depth, the rest of the EU lightly. */
const ADZUNA_COUNTRIES = ["pl", "de", "nl", "at", "fr", "be", "es", "it"];
async function adzuna(_f: PoliteFetcher, _s: SourceRef, want: WantDetail): Promise<Fetched> {
  const e = env();
  if (!e.ADZUNA_APP_ID || !e.ADZUNA_APP_KEY)
    throw new SourceError("config", "ADZUNA_APP_ID/ADZUNA_APP_KEY not set");
  const out = new Map<string, RawJob>();
  let total = 0;
  for (const country of ADZUNA_COUNTRIES) {
    const queries = country === "pl" ? SEARCH_QUERIES.slice(0, 6) : SEARCH_QUERIES.slice(0, 2);
    for (const q of queries) {
      const u = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
      u.search = new URLSearchParams({
        app_id: e.ADZUNA_APP_ID,
        app_key: e.ADZUNA_APP_KEY,
        what: q,
        results_per_page: "50",
        max_days_old: "21",
        "content-type": "application/json",
      }).toString();
      const res = await httpFetch(u.toString(), {
        timeoutMs: 20_000,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new SourceError("http", `adzuna ${res.status}`);
      const d = obj(await res.json());
      const list = arr(d.results);
      total += list.length;
      for (const x of list) {
        const j = obj(x);
        const title = clean(j.title).replace(/<\/?strong>/g, "");
        const loc = clean(obj(j.location).display_name);
        if (!want(title, loc)) continue;
        out.set(str(j.id), {
          externalId: str(j.id),
          title,
          companyName: clean(obj(j.company).display_name) || "—",
          location: loc ? `${loc}, ${country.toUpperCase()}` : country.toUpperCase(),
          countries: [country.toUpperCase()],
          employmentType: [clean(j.contract_type), clean(j.contract_time)].filter(Boolean).join(", ") || null,
          description: htmlToText(str(j.description)),
          url: str(j.redirect_url),
          postedAt: toDate(j.created),
        });
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  return { jobs: [...out.values()], complete: false, total };
}

/** Jooble (free key): listings gathered from many Polish and EU job sites. */
// The key is tied to one Jooble country site. An international key searches the global index, where
// "Warsaw" means Warsaw, Indiana: ask for Poland and Europe instead (non-EU places are filtered later).
const JOOBLE_LOCATIONS = ["Poland", "Europe"];
async function jooble(_f: PoliteFetcher, _s: SourceRef, want: WantDetail): Promise<Fetched> {
  const key = env().JOOBLE_API_KEY;
  if (!key) throw new SourceError("config", "JOOBLE_API_KEY not set");
  const out = new Map<string, RawJob>();
  let total = 0;
  for (const location of JOOBLE_LOCATIONS) {
    for (const q of SEARCH_QUERIES.slice(0, 6)) {
      const res = await httpFetch(`https://jooble.org/api/${encodeURIComponent(key)}`, {
        method: "POST",
        timeoutMs: 20_000,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ keywords: q, location, page: "1" }),
      });
      if (!res.ok) throw new SourceError("http", `jooble ${res.status}`);
      const d = obj(await res.json());
      const list = arr(d.jobs);
      total += list.length;
      for (const x of list) {
        const j = obj(x);
        const title = clean(j.title).replace(/<\/?b>/g, "");
        const loc = clean(j.location);
        if (!want(title, loc)) continue;
        // The global index sometimes labels US jobs with a European country: "(Remote) PA, DE, NY".
        if (/\b[A-Z]{2}, [A-Z]{2}\b|\bU\.?S\.?A?\b|United States/.test(`${title} ${clean(j.snippet)}`))
          continue;
        const id = str(j.id) || str(j.link);
        out.set(id, {
          externalId: id,
          title,
          companyName: clean(j.company) || "—",
          location: loc || null,
          employmentType: clean(j.type) || null,
          description: htmlToText(str(j.snippet)),
          url: str(j.link),
          postedAt: toDate(j.updated),
        });
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return { jobs: [...out.values()], complete: false, total };
}

export const SUPPORTED_KINDS = new Set([
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "workable",
  "recruitee",
  "personio",
  "teamtailor",
  "eightfold",
  "workday",
  "arbeitnow",
  "himalayas",
  "adzuna",
  "jooble",
  "careers_page",
]);

export async function fetchSource(f: PoliteFetcher, s: SourceRef, want: WantDetail): Promise<Fetched> {
  switch (s.kind) {
    case "greenhouse":
      return greenhouse(f, s);
    case "lever":
      return lever(f, s);
    case "ashby":
      return ashby(f, s);
    case "smartrecruiters":
      return smartrecruiters(f, s, want);
    case "workable":
      return workable(f, s);
    case "recruitee":
      return recruitee(f, s);
    case "personio":
      return personio(f, s);
    case "teamtailor":
      return teamtailor(f, s);
    case "eightfold":
      return eightfold(f, s, want);
    case "workday":
      return workday(f, s, want);
    case "careers_page":
      return careersPage(f, s, want);
    case "arbeitnow":
      return arbeitnow(f, s, want);
    case "himalayas":
      return himalayas(f, s, want);
    case "adzuna":
      return adzuna(f, s, want);
    case "jooble":
      return jooble(f, s, want);
    default:
      throw new SourceError("config", `${s.kind} is not supported yet`);
  }
}
