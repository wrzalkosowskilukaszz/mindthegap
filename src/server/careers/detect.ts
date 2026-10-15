/**
 * Finds a company's careers page and the job-board system behind it, from links on its own website.
 * Two or three polite page fetches per company; nothing is guessed. Unsupported systems (Workday,
 * SuccessFactors) are recorded so the careers link is still shown.
 */
import * as cheerio from "cheerio";
import type { PoliteFetcher } from "../discovery/fetcher.ts";

export type DetectedBoard = { kind: string; token: string; url: string; supported: boolean };

const PATTERNS: { kind: string; re: RegExp; token: (m: RegExpMatchArray) => string; supported?: boolean }[] =
  [
    {
      kind: "greenhouse",
      re: /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([a-z0-9_-]+)/i,
      token: (m) => m[1]!.toLowerCase(),
    },
    { kind: "lever", re: /jobs\.(?:eu\.)?lever\.co\/([a-z0-9_.-]+)/i, token: (m) => m[1]!.toLowerCase() },
    { kind: "ashby", re: /jobs\.ashbyhq\.com\/([a-z0-9_.%-]+)/i, token: (m) => decodeURIComponent(m[1]!) },
    {
      kind: "smartrecruiters",
      re: /(?:careers|jobs)\.smartrecruiters\.com\/([a-z0-9_-]+)/i,
      token: (m) => m[1]!,
    },
    { kind: "workable", re: /apply\.workable\.com\/([a-z0-9_-]+)/i, token: (m) => m[1]!.toLowerCase() },
    { kind: "recruitee", re: /\b([a-z0-9-]+)\.recruitee\.com/i, token: (m) => m[1]!.toLowerCase() },
    {
      kind: "personio",
      re: /\b([a-z0-9-]+\.jobs\.personio\.(?:de|com))/i,
      token: (m) => m[1]!.toLowerCase(),
    },
    { kind: "teamtailor", re: /\b([a-z0-9-]+)\.teamtailor\.com/i, token: (m) => m[1]!.toLowerCase() },
    {
      kind: "workday",
      re: /\b([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/,
      token: (m) => `${m[1]!.toLowerCase()}|${m[2]!.toLowerCase()}|${m[3]}`,
    },
    {
      kind: "successfactors",
      re: /\b(career\d*\.successfactors\.(?:eu|com)\/career\?company=[A-Za-z0-9_-]+|jobs\.sap\.com)/i,
      token: (m) => m[1]!,
      supported: false,
    },
  ];

const IGNORE_TOKENS = new Set(["embed", "api", "jobs", "careers", "www", "static", "assets", "cdn", "app"]);

export function findBoards(html: string): DetectedBoard[] {
  const out = new Map<string, DetectedBoard>();
  for (const p of PATTERNS) {
    for (const m of html.matchAll(new RegExp(p.re.source, `${p.re.flags.replace("g", "")}g`))) {
      const token = p.token(m);
      if (!token || IGNORE_TOKENS.has(token.toLowerCase())) continue;
      const key = `${p.kind}:${token}`;
      if (!out.has(key))
        out.set(key, {
          kind: p.kind,
          token,
          url: m[0].startsWith("http") ? m[0] : `https://${m[0]}`,
          supported: p.supported !== false,
        });
    }
  }
  return [...out.values()];
}

const CAREER_TEXT =
  /(kariera|karier[aęy]|careers?|praca|pracuj z nami|oferty pracy|dołącz|join (us|our team)|work (with|at) us|jobs|rekrutacj|vacancies|stellen|karriere)/i;

/** Links that look like a careers page, best first. */
export function careerLinks(html: string, base: string): string[] {
  const $ = cheerio.load(html);
  const baseHost = new URL(base).hostname.replace(/^www\./, "");
  const scored: { url: string; score: number }[] = [];
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    const text = $(a).text().replace(/\s+/g, " ").trim().slice(0, 80);
    let u: URL;
    try {
      u = new URL(href, base);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol)) return;
    const hay = `${u.hostname}${u.pathname} ${text}`;
    if (!CAREER_TEXT.test(hay)) return;
    const host = u.hostname.replace(/^www\./, "");
    const sameOrg = host === baseHost || host.endsWith(`.${baseHost}`) || baseHost.endsWith(`.${host}`);
    let score = 0;
    if (/^(kariera|careers?|jobs|praca)\./.test(host)) score += 4;
    if (/\/(kariera|careers?|jobs|praca|oferty-pracy)\b/i.test(u.pathname)) score += 3;
    if (CAREER_TEXT.test(text)) score += 2;
    if (sameOrg) score += 1;
    if (/linkedin|facebook|instagram|twitter|youtube|pracuj\.pl|goldenline/i.test(host)) return;
    scored.push({ url: u.toString().split("#")[0]!, score });
  });
  return [...new Map(scored.sort((a, b) => b.score - a.score).map((s) => [s.url, s])).keys()].slice(0, 3);
}

export async function detectCareers(
  f: PoliteFetcher,
  website: string,
): Promise<{ careersUrl: string | null; boards: DetectedBoard[]; error?: string }> {
  const home = await f.get(website);
  if (!home.ok) return { careersUrl: null, boards: [], error: `${home.reason} ${home.status ?? ""}`.trim() };
  const boards = findBoards(home.body);
  const links = careerLinks(home.body, home.url);
  let careersUrl: string | null = links[0] ?? null;
  for (const link of links.slice(0, 2)) {
    if (boards.some((b) => b.supported)) break;
    const direct = findBoards(link);
    if (direct.length) {
      boards.push(...direct);
      break;
    }
    const page = await f.get(link);
    if (!page.ok) continue;
    careersUrl = page.url;
    boards.push(...findBoards(page.body));
    // One level deeper: "see all offers" links on the careers page often lead to the board.
    if (!boards.some((b) => b.supported)) {
      const deeper = careerLinks(page.body, page.url).find((u) => u !== link && !links.includes(u));
      if (deeper) {
        const direct2 = findBoards(deeper);
        if (direct2.length) boards.push(...direct2);
        else {
          const p2 = await f.get(deeper);
          if (p2.ok) boards.push(...findBoards(p2.body));
        }
      }
    }
  }
  const unique = [...new Map(boards.map((b) => [`${b.kind}:${b.token}`, b])).values()];
  return { careersUrl, boards: unique };
}
