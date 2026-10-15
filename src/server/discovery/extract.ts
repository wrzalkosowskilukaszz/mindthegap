/**
 * Extraction from fetched public pages. Pure functions (no I/O), unit-tested.
 *
 * Integrity rule: every name, title and email returned here occurs verbatim in the page text,
 * and each candidate carries the compact text block it was found in (stored as the evidence quote).
 * Page content is data, never instructions.
 */
import * as cheerio from "cheerio";
import { assessRole, type RoleAssessment } from "@/lib/roles";
import { classifyMailbox, domainLabel, foldDiacritics, type MailboxType, normalizeEmail, registrableDomain } from "@/lib/normalize";
import { FIRST_NAMES } from "@/lib/first-names";

export type PageLink = { url: string; text: string };
export type EmailCandidate = { email: string; mailbox: MailboxType; block: string; invitation: boolean };
export type PersonCandidate = {
  fullName: string;
  title: string;
  role: RoleAssessment;
  email: string | null;
  block: string;
};
export type PageExtraction = {
  title: string;
  publishedAt: string | null;
  emails: EmailCandidate[];
  people: PersonCandidate[];
  /** Compact blocks mentioning a relevant role where no person was recognised (input for optional AI help). */
  roleBlocks: string[];
  links: PageLink[];
  textLength: number;
};

const BLOCK_TAGS = new Set([
  "p", "li", "td", "th", "dd", "dt", "div", "article", "section", "address", "footer", "header", "aside",
  "h1", "h2", "h3", "h4", "h5", "h6", "figcaption", "blockquote", "tr", "ul", "ol", "table", "main", "nav", "form", "fieldset",
]);

const MAX_BLOCK = 420;

type DomNode = { type: string; data?: string; name?: string; children?: DomNode[] };

/** Text with newlines between block elements and <br>, whitespace normalised per line. */
function textOf(_$: cheerio.CheerioAPI, el: unknown): string {
  const parts: string[] = [];
  const walk = (n: DomNode) => {
    if (n.type === "text") {
      parts.push(n.data ?? "");
      return;
    }
    if (n.type !== "tag") return;
    const tag = n.name ?? "";
    if (tag === "br") {
      parts.push("\n");
      return;
    }
    const block = BLOCK_TAGS.has(tag);
    if (block) parts.push("\n");
    for (const c of n.children ?? []) walk(c);
    if (block) parts.push("\n");
  };
  walk(el as DomNode);
  return parts
    .join("")
    .split("\n")
    .map((l) => l.replace(/[\s ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** "anna.kowalska [at] firma [dot] pl" → "anna.kowalska@firma.pl" */
export function deobfuscate(text: string): string {
  return text
    .replace(/\s*(\[|\(|\{)\s*(at|małpa|malpa)\s*(\]|\)|\})\s*/gi, "@")
    .replace(/\s+(at|małpa)\s+(?=[a-z0-9-]+\s*(\[|\(|\{)?\s*(dot|kropka)\s*(\]|\)|\})?)/gi, "@")
    .replace(/\s*(\[|\(|\{)\s*(dot|kropka)\s*(\]|\)|\})\s*/gi, ".");
}

const EMAIL_RE = /[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;

export function findEmails(text: string): string[] {
  const out = new Set<string>();
  for (const m of deobfuscate(text).matchAll(EMAIL_RE)) {
    const n = normalizeEmail(m[0]);
    if (n && !/\.(png|jpe?g|gif|svg|webp)$/.test(n)) out.add(n);
  }
  return [...out];
}

const NAME_TOKEN = "[A-ZĄĆĘŁŃÓŚŹŻÄÖÜ][a-ząćęłńóśźżäöüéè]+(?:-[A-ZĄĆĘŁŃÓŚŹŻÄÖÜ][a-ząćęłńóśźżäöüéè]+)?";
const NAME_RE = new RegExp(`(?<![\\p{L}])(${NAME_TOKEN})\\s+(${NAME_TOKEN})(?![\\p{L}])`, "gu");

/** Names whose first token is a known first name. Returned exactly as written on the page. */
export function findNames(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(NAME_RE)) {
    const first = foldDiacritics(m[1]!);
    const last = foldDiacritics(m[2]!);
    if (!FIRST_NAMES.has(first)) continue;
    if (FIRST_NAMES.has(last) && last !== first && !/(ska|cka|dzka|ski|cki|dzki|wicz|czyk|ak|ek|ik|uk)$/.test(last)) continue;
    if (/^(dyrektor|kierownik|menedzer|manager|head|director|prezes|czlonek|zespol|dzial)$/.test(last)) continue;
    out.push(`${m[1]} ${m[2]}`);
  }
  return [...new Set(out)];
}

/** Does the email's local part plausibly belong to this person? (anna.kowalska, akowalska, a.kowalska, kowalska.anna) */
export function emailMatchesName(email: string, fullName: string): boolean {
  const local = email.slice(0, email.indexOf("@")).toLowerCase();
  const [first, ...rest] = foldDiacritics(fullName).split(/\s+/);
  const last = rest.join("").replace(/-/g, "");
  if (!first || !last) return false;
  const l = local.replace(/[._-]/g, "");
  return l.includes(last) && (l.includes(first) || l.startsWith(first[0]!) || l.endsWith(first[0]!));
}

const INVITATION_RE =
  /(ofert\w* (szkoleni\w*|szkoleniow\w*|rozwojow\w*)|przesyła\w* ofert|prosimy o (przesyłanie|kierowanie|nadsyłanie) ofert|ofert\w* (prosimy|należy) (kierować|przesyłać)|dla dostawców|współprac\w* z dostawc\w*|zapytani\w* ofertow\w*|suppliers?|vendor|submit (your )?(offer|proposal)s?|proposals? (should|can) be sent|procurement)/i;

/** Splits a compact block into candidate title segments. */
function segments(block: string): string[] {
  return block
    .split(/\n|\s[|•·–—]\s|,\s(?=[A-ZĄĆĘŁŃÓŚŹŻ])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 140);
}

function bestTitle(block: string, name: string): { title: string; role: RoleAssessment } | null {
  let best: { title: string; role: RoleAssessment; rank: number } | null = null;
  for (const seg of segments(block.replace(name, "\n"))) {
    const role = assessRole(seg);
    if (!role.relevant) continue;
    const rank = role.category === "decision_maker" ? 2 : 1;
    if (!best || rank > best.rank || (rank === best.rank && seg.length < best.title.length)) best = { title: seg, role, rank };
  }
  return best ? { title: best.title, role: best.role } : null;
}

function publishedDate($: cheerio.CheerioAPI): string | null {
  const metas = [
    $('meta[property="article:published_time"]').attr("content"),
    $('meta[name="date"]').attr("content"),
    $('meta[itemprop="datePublished"]').attr("content"),
    $("time[datetime]").first().attr("datetime"),
  ];
  for (const s of $('script[type="application/ld+json"]').toArray()) {
    const m = $(s).text().match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (m) metas.push(m[1]);
  }
  for (const v of metas) {
    if (!v) continue;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() > 1995 && d.getTime() <= Date.now() + 86_400_000) return d.toISOString().slice(0, 10);
  }
  return null;
}

export function extractPage(html: string, pageUrl: string, companyDomains: string[]): PageExtraction {
  const $ = cheerio.load(html);
  $("script:not([type='application/ld+json']), style, noscript, svg, iframe, template, canvas").remove();
  const title = $("title").first().text().trim().slice(0, 200);
  const publishedAt = publishedDate($);
  $("script").remove();
  const domains = new Set(companyDomains.map((d) => d.toLowerCase()));
  // Same organisation under another TLD (site on .pl, mail on .com) counts as the company's own domain.
  const labels = new Set([...domains].map((d) => domainLabel(d)).filter((l) => l.length >= 4));
  const ownDomain = (reg: string | null): boolean => Boolean(reg && (domains.has(reg) || labels.has(domainLabel(reg))));

  // Links (same registrable domain only).
  const links: PageLink[] = [];
  const seen = new Set<string>();
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    if (/^(mailto|tel|javascript):/i.test(href)) return;
    try {
      const u = new URL(href, pageUrl);
      if (!/^https?:$/.test(u.protocol)) return;
      u.hash = "";
      const reg = registrableDomain(u.hostname);
      if (!ownDomain(reg)) return;
      const key = u.toString();
      if (seen.has(key)) return;
      seen.add(key);
      links.push({ url: key, text: $(a).text().replace(/\s+/g, " ").trim().slice(0, 120) });
    } catch {
      /* ignore bad hrefs */
    }
  });

  // mailto: links contribute emails even when the visible text is a name.
  const mailtoBlocks = new Map<string, string>();
  $("a[href^='mailto:' i]").each((_, a) => {
    const raw = decodeURIComponent(($(a).attr("href") ?? "").replace(/^mailto:/i, "").split("?")[0] ?? "");
    const e = normalizeEmail(raw);
    if (!e) return;
    let parent = $(a).parent();
    for (let i = 0; i < 4 && parent.length; i++) {
      const t = textOf($, parent[0]!);
      if (t.length > 40 || i === 3) {
        if (t.length <= MAX_BLOCK * 2) mailtoBlocks.set(e, t.includes(raw) ? t : `${t}\n${raw}`);
        break;
      }
      parent = parent.parent();
    }
  });

  // Compact blocks: smallest elements whose text is short enough to be a "card".
  const blocks: string[] = [];
  const bodyEl = $("body").get(0) ?? $.root().get(0);
  const body = $(bodyEl);
  body.find("*").each((i, el) => {
    if (i > 8000) return false;
    const tag = (el as unknown as { name: string }).name;
    if (!BLOCK_TAGS.has(tag) && tag !== "span" && tag !== "a" && tag !== "strong") return;
    const t = textOf($, el);
    if (t.length >= 8 && t.length <= MAX_BLOCK) blocks.push(t);
  });
  const fullText = textOf($, bodyEl);

  // Emails within company domains.
  const emails = new Map<string, EmailCandidate>();
  const considerEmail = (e: string, block: string) => {
    const dom = e.slice(e.indexOf("@") + 1);
    if (!ownDomain(registrableDomain(dom))) return;
    const prev = emails.get(e);
    const b = block.length > MAX_BLOCK ? windowAround(block, e) : block;
    if (prev && prev.block.length <= b.length) return;
    emails.set(e, { email: e, mailbox: classifyMailbox(e), block: b, invitation: INVITATION_RE.test(b) || INVITATION_RE.test(windowAround(fullText, e, 400)) });
  };
  for (const [e, b] of mailtoBlocks) considerEmail(e, b);
  for (const b of blocks) for (const e of findEmails(b)) considerEmail(e, b);
  for (const e of findEmails(fullText)) if (!emails.has(e)) considerEmail(e, windowAround(fullText, e));

  // People: a known-name + relevant title in the same compact block.
  const people = new Map<string, PersonCandidate>();
  const sorted = [...new Set(blocks)].sort((a, b) => a.length - b.length);
  for (const b of sorted) {
    if (b.length > MAX_BLOCK) continue;
    for (const name of findNames(b)) {
      if (people.has(name)) continue;
      const t = bestTitle(b, name);
      if (!t) continue;
      const blockEmails = findEmails(b);
      const email = blockEmails.find((e) => emailMatchesName(e, name)) ?? null;
      people.set(name, { fullName: name, title: t.title, role: t.role, email, block: b });
    }
  }
  // A person's email may sit in a mailto link near the name rather than in the same block.
  for (const p of people.values()) {
    if (p.email) continue;
    const match = [...emails.keys()].find((e) => emailMatchesName(e, p.fullName));
    if (match) p.email = match;
  }

  const personBlocks = new Set([...people.values()].map((p) => p.block));
  const roleBlocks: string[] = [];
  for (const b of sorted) {
    if (roleBlocks.length >= 30) break;
    if (b.length < 20 || personBlocks.has(b)) continue;
    if (/[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+/.test(b) && assessRole(b).relevant) roleBlocks.push(b);
  }

  return { title, publishedAt, emails: [...emails.values()], people: [...people.values()], roleBlocks, links, textLength: fullText.length };
}

function windowAround(text: string, needle: string, radius = 160): string {
  const i = deobfuscate(text).toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return text.slice(0, MAX_BLOCK);
  return text.slice(Math.max(0, i - radius), i + needle.length + radius).trim();
}

/** Verbatim check used before storing a quote-backed value: whitespace/case-insensitive containment. */
export function containsVerbatim(haystack: string, needle: string): boolean {
  const norm = (s: string) => deobfuscate(s).replace(/[\s ]+/g, " ").toLowerCase().trim();
  return norm(haystack).includes(norm(needle));
}

// ---------------------------------------------------------------------------
// Link scoring for bounded crawling
// ---------------------------------------------------------------------------

const LINK_RULES: [RegExp, number][] = [
  [/(akademi|academy|szkolen|training|learning|rozwoj|development|talent|l-d|lnd)/, 9],
  [/(dostawc|supplier|vendor|zakup|procurement|przetarg|zapytani|oferty-dla)/, 8],
  [/(zarzad|management|leadership|board|kadra-kierownicza|our-team|nasz-zespol|zespol|team|people|ludzie|o-nas\/zespol)/, 7],
  [/(kontakt|contact)/, 6],
  [/(hr|kariera|careers?|praca|pracuj|jobs|work-with-us|employer|pracodawca|kultura|culture|benefity|benefits)/, 5],
  [/(o-nas|about|o-firmie|company|firma|who-we-are)/, 4],
  [/(media|press|prasa|biuro-prasowe|newsroom|aktualnosci|news)/, 2],
];
const LINK_NEGATIVE = /(\.(pdf|jpg|png|zip|docx?|xlsx?|pptx?|mp4)$|login|logowanie|koszyk|cart|sklep|shop|produkt|product|oferta-pracy|job-offer|\/jobs\/\d|regulamin|cookies|polityka-prywatnosci|privacy|rodo|search|szukaj|\?|#|\/en\/(?!about|contact))/;

export function scoreLink(url: string, text: string): number {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return 0;
  }
  if (path === "/" || path === "") return 0;
  if (LINK_NEGATIVE.test(url.toLowerCase())) return 0;
  const hay = `${foldDiacritics(decodeURIComponent(path))} ${foldDiacritics(text)}`;
  let score = 0;
  for (const [re, w] of LINK_RULES) if (re.test(hay)) score = Math.max(score, w);
  // Prefer shallow pages.
  const depth = path.split("/").filter(Boolean).length;
  return score > 0 ? score - Math.min(depth, 4) * 0.3 : 0;
}

export function sitemapUrls(xml: string): { urls: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!.replace(/&amp;/g, "&"));
  return /<sitemapindex/i.test(xml) ? { urls: [], sitemaps: locs } : { urls: locs, sitemaps: [] };
}
