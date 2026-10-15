/**
 * Extraction from fetched public pages. Pure functions (no I/O), unit-tested.
 *
 * Integrity rule: every name, title and email returned here occurs verbatim in the page text,
 * and each candidate carries the compact text block it was found in (stored as the evidence quote).
 * Page content is data, never instructions.
 */
import * as cheerio from "cheerio";
import { FIRST_NAMES } from "@/lib/first-names";
import {
  classifyMailbox,
  domainLabel,
  foldDiacritics,
  type MailboxType,
  NON_BUYER_LOCAL,
  normalizeEmail,
  registrableDomain,
} from "@/lib/normalize";
import { assessRole, type RoleAssessment } from "@/lib/roles";

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
  "p",
  "li",
  "td",
  "th",
  "dd",
  "dt",
  "div",
  "article",
  "section",
  "address",
  "footer",
  "header",
  "aside",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "figcaption",
  "blockquote",
  "tr",
  "ul",
  "ol",
  "table",
  "main",
  "nav",
  "form",
  "fieldset",
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
    if (
      FIRST_NAMES.has(last) &&
      last !== first &&
      !/(ska|cka|dzka|ski|cki|dzki|wicz|czyk|ak|ek|ik|uk)$/.test(last)
    )
      continue;
    if (/^(dyrektor|kierownik|menedzer|manager|head|director|prezes|czlonek|zespol|dzial)$/.test(last))
      continue;
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

/** Explicit invitations to send offers (supplier / procurement channels). Checked only inside the address's own block. */
const INVITATION_RE = new RegExp(
  [
    "prosimy o (przesyłanie|kierowanie|nadsyłanie|składanie) ofert",
    "ofert\\w* (prosimy|należy) (kierować|przesyłać|składać|wysyłać)",
    "zapraszamy (do )?(składania|przesyłania|nadsyłania) ofert",
    "ofert\\w*( handlow\\w*| współpracy| szkoleniow\\w*)? (prosimy )?(kierować|przesyłać|wysyłać) (na adres|pod adres|na e-?mail)",
    "(dla|do) (potencjalnych )?dostawców[^.]{0,80}(adres|e-?mail|kontakt)",
    "(send|submit) (us )?(your )?(commercial )?(offers?|proposals?|quotes?)",
    "(offers?|proposals?) (should|can|may) be (sent|submitted|addressed)",
    "(potential|prospective) (suppliers|vendors)[^.]{0,60}(contact|e-?mail|write)",
  ].join("|"),
  "i",
);

/**
 * Does the invitation in this block point at this address? Only the first address written within
 * 160 characters after an invitation phrase counts, and never a press, investor or privacy mailbox.
 */
export function invitationFor(email: string, block: string): boolean {
  const local = email.slice(0, email.indexOf("@"));
  if (NON_BUYER_LOCAL.test(local)) return false;
  const lower = deobfuscate(block).toLowerCase();
  const re = new RegExp(INVITATION_RE.source, "gi");
  for (const m of lower.matchAll(re)) {
    const end = (m.index ?? 0) + m[0].length;
    const after = lower.slice(end, end + 160);
    const first = after.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
    if (first && first[0] === email.toLowerCase()) return true;
  }
  return false;
}

/** What a purchasing address buys: training is a service, bought by indirect/services procurement. */
export function procurementScope(block: string): "services" | "direct" | "unknown" {
  const t = foldDiacritics(block);
  const services = /(uslug|szkolen|posredni|nieprodukcyjn|indirect|services?\b|consulting|doradz|hr\b)/.test(
    t,
  );
  const direct =
    /(komponent|surowc|material\w* (do )?produkc|czesci|opakowa|raw material|components|direct material|do produkcji)/.test(
      t,
    );
  return services ? "services" : direct ? "direct" : "unknown";
}

const COUNTRY_RE =
  /\b(chorwacj\w*|czech\w*|republik\w* czesk\w*|slowacj\w*|wegr\w*|niemc\w*|niemiec|austri\w*|rumuni\w*|bulgari\w*|serbi\w*|slowenia|slowenii|litw\w*|lotw\w*|estoni\w*|ukrain\w*|hiszpani\w*|francj\w*|wloch\w*|wlochy|portugali\w*|holandi\w*|belgi\w*|szwecj\w*|dani[ia]\b|norwegi\w*|finlandi\w*|wielk\w* brytani\w*|irlandi\w*|rosj\w*|bialorus\w*|szwajcari\w*|croatia|czechia|czech republic|slovakia|hungary|germany|romania|bulgaria|serbia|slovenia|lithuania|latvia|estonia|ukraine|spain|france|italy|portugal|netherlands|belgium|sweden|denmark|norway|finland|united kingdom|ireland|switzerland)\b/;
const POLAND_RE = /\b(polska|polsce|poland|polish)\b|\b\d{2}-\d{3}\b/;

/** The block describes another country's entity (an address abroad and nothing Polish). */
export function foreignEntity(block: string): boolean {
  const t = foldDiacritics(block);
  return COUNTRY_RE.test(t) && !POLAND_RE.test(t);
}

/** Generic TLDs and Poland's: another country's ccTLD usually means a foreign group company. */
const OK_TLD = /\.(pl|eu|com|net|org|group|global|info|biz|io|co|company|team)$/;

/** Strips list dashes, bullets and separators around a title. */
export function cleanTitle(t: string): string {
  return t.replace(/^[\s\-–—|,:;•·*]+|[\s\-–—|,:;•·*]+$/g, "").replace(/\s+/g, " ");
}

/** Splits a compact block into candidate title segments. */
function segments(block: string): string[] {
  return block
    .split(/\n|\s[|•·–—]\s|,\s(?=[A-ZĄĆĘŁŃÓŚŹŻ])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 140);
}

function bestTitle(
  block: string,
  name: string,
  assess: (title: string) => RoleAssessment,
): { title: string; role: RoleAssessment } | null {
  let best: { title: string; role: RoleAssessment; rank: number } | null = null;
  for (const seg of segments(block.replace(name, "\n"))) {
    // A job title is a short phrase, not a sentence ("…jest jedną z 100 najbardziej wpływowych osób…").
    if (
      seg.length > 90 ||
      /\b(jest|była|był|został[ao]?|odbyło się|is|was|has been|one of)\b/i.test(seg) ||
      /^(as|is|nasza|nasz|our)\b/i.test(seg)
    )
      continue;
    const role = assess(seg);
    if (!role.relevant) continue;
    const rank = role.category === "decision_maker" ? 2 : 1;
    if (!best || rank > best.rank || (rank === best.rank && seg.length < best.title.length))
      best = { title: seg, role, rank };
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
    const m = $(s)
      .text()
      .match(/"datePublished"\s*:\s*"([^"]+)"/);
    if (m) metas.push(m[1]);
  }
  for (const v of metas) {
    if (!v) continue;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime()) && d.getFullYear() > 1995 && d.getTime() <= Date.now() + 86_400_000)
      return d.toISOString().slice(0, 10);
  }
  return null;
}

const FREEMAIL =
  /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|wp|o2|onet|op|interia|poczta|tlen|gazeta|vp|go2|protonmail|proton|gmx|web|t-online|aol|mail|yandex)\./;
const GENERIC_NAME_WORDS = new Set([
  "polska",
  "poland",
  "group",
  "grupa",
  "bank",
  "spolka",
  "akcyjna",
  "company",
  "services",
  "service",
  "centre",
  "center",
  "solutions",
  "global",
  "europe",
  "holding",
  "international",
  "business",
  "technologies",
  "technology",
  "the",
]);

/** Brand tokens (≥4 letters) used to accept a company's own mail domain on a different name, e.g. kruk.eu → kruksa.pl. */
export function brandTokens(names: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    if (!n) continue;
    for (const w of foldDiacritics(n).split(/[^a-z0-9]+/))
      if (w.length >= 4 && !GENERIC_NAME_WORDS.has(w)) out.add(w);
  }
  return [...out];
}

export function extractPage(
  html: string,
  pageUrl: string,
  companyDomains: string[],
  brandHints: string[] = [],
  /** Role rules; research passes the built-in rules plus the owner's keyword lists. */
  assess: (title: string) => RoleAssessment = assessRole,
): PageExtraction {
  const $ = cheerio.load(html);
  $("script:not([type='application/ld+json']), style, noscript, svg, iframe, template, canvas").remove();
  const title = $("title").first().text().trim().slice(0, 200);
  const publishedAt = publishedDate($);
  $("script").remove();
  const domains = new Set(companyDomains.map((d) => d.toLowerCase()));
  // Same organisation under another TLD (site on .pl, mail on .com) counts as the company's own domain.
  const labels = new Set([...domains].map((d) => domainLabel(d)).filter((l) => l.length >= 4));
  const tokens = brandTokens([...[...domains].map(domainLabel), ...brandHints]);
  const ownDomain = (reg: string | null): boolean => {
    if (!reg) return false;
    if (domains.has(reg)) return true;
    // Same brand elsewhere: accept .pl and generic TLDs only (angelini.it is the Italian parent, not Poland).
    if (!OK_TLD.test(reg)) return false;
    if (labels.has(domainLabel(reg))) return true;
    if (FREEMAIL.test(reg)) return false;
    const label = domainLabel(reg);
    return tokens.some((t) => label.includes(t));
  };

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
    const b = block.length > MAX_BLOCK ? windowAround(block, e) : block;
    const prev = emails.get(e);
    // Prefer the smallest block that still gives context (≥ 40 chars); a bare address is a poor quote.
    const better =
      !prev ||
      (prev.block.length < 40
        ? b.length > prev.block.length
        : b.length >= 40 && b.length < prev.block.length);
    const invitation = (prev?.invitation ?? false) || invitationFor(e, b);
    if (better) emails.set(e, { email: e, mailbox: classifyMailbox(e), block: b, invitation });
    else if (invitation && !prev.invitation) emails.set(e, { ...prev, invitation });
  };
  for (const [e, b] of mailtoBlocks) considerEmail(e, b);
  for (const b of blocks) for (const e of findEmails(b)) considerEmail(e, b);
  for (const e of findEmails(fullText)) if (!emails.has(e)) considerEmail(e, windowAround(fullText, e));
  // An address abroad (another country's subsidiary) is not a contact in Poland. Judged on the
  // address's own (smallest) block, so a neighbouring Polish address does not mask it.
  for (const [e, c] of emails) if (foreignEntity(windowAround(c.block, e, 160))) emails.delete(e);

  // People: a known name + relevant title in the person's own "card" — the smallest block that contains
  // the name and something else. Titles are never borrowed from larger blocks (another person's card).
  const people = new Map<string, PersonCandidate>();
  const sorted = [...new Set(blocks)].sort((a, b) => a.length - b.length);
  const allNames = new Set<string>();
  for (const b of sorted) for (const n of findNames(b)) allNames.add(n);
  for (const name of allNames) {
    const card = sorted.find(
      (b) => b.includes(name) && b.replace(name, "").trim().length >= 3 && b.length <= MAX_BLOCK,
    );
    if (!card) continue;
    const namesInCard = findNames(card);
    let t: { title: string; role: RoleAssessment } | null = null;
    if (namesInCard.length === 1) t = bestTitle(card, name, assess);
    else {
      // Several people in one block: only the line right after the name belongs to this person.
      const lines = card.split("\n");
      const i = lines.findIndex((l) => l.includes(name));
      const sameLine =
        lines[i]
          ?.replace(name, "")
          .replace(/^[\s,–—|-]+/, "")
          .trim() ?? "";
      const candidate = sameLine.length >= 3 ? sameLine : (lines[i + 1] ?? "");
      const role = assess(candidate);
      if (role.relevant && findNames(candidate).length === 0) t = { title: candidate.trim(), role };
    }
    if (!t) continue;
    const blockEmails = findEmails(card);
    const email = blockEmails.find((e) => emailMatchesName(e, name)) ?? null;
    if (foreignEntity(card)) continue; // e.g. the HR director of the Czech subsidiary
    people.set(name, { fullName: name, title: cleanTitle(t.title), role: t.role, email, block: card });
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
    if (/[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+\s+[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+/.test(b) && assess(b).relevant)
      roleBlocks.push(b);
  }

  return {
    title,
    publishedAt,
    emails: [...emails.values()],
    people: [...people.values()],
    roleBlocks,
    links,
    textLength: fullText.length,
  };
}

function windowAround(text: string, needle: string, radius = 160): string {
  const i = deobfuscate(text).toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return text.slice(0, MAX_BLOCK);
  return text.slice(Math.max(0, i - radius), i + needle.length + radius).trim();
}

/** Verbatim check used before storing a quote-backed value: whitespace/case-insensitive containment. */
export function containsVerbatim(haystack: string, needle: string): boolean {
  const norm = (s: string) =>
    deobfuscate(s)
      .replace(/[\s ]+/g, " ")
      .toLowerCase()
      .trim();
  return norm(haystack).includes(norm(needle));
}

// ---------------------------------------------------------------------------
// Link scoring for bounded crawling
// ---------------------------------------------------------------------------

// Matched against individual path segments (folded), so "zrownowazony-rozwoj" (sustainability) or
// "o-czym-pamietac-przy-zakupie" (an article) don't count as development or procurement pages.
const SEGMENT_RULES: [RegExp, number][] = [
  [
    /(^|-)(akademi\w*|academy|szkolen\w*|training|learning)(-|$)|^(l-?and-?d|people-development|rozwoj-pracownikow|rozwoj-talentow|talent-development|leadership-development|programy-rozwojowe)$/,
    9,
  ],
  [
    /^(dla-dostawcow|dostawcy|suppliers?|vendors?|procurement|zakupy|zapytania-ofertowe|przetargi|wspolpraca-z-dostawcami|purchasing|supplier-portal|portal-dostawcy|zostan-dostawca|become-a-supplier)$/,
    8,
  ],
  [/^(kontakt|kontakty|contact|contact-us|kontakt-z-nami|dane-kontaktowe)$/, 7],
  [
    /^(zarzad|management|leadership|board|kadra-zarzadzajaca|kadra-kierownicza|nasz-zespol|zespol|our-team|team|people|ludzie|wladze-spolki|management-board|leadership-team|executive-team|zespol-zarzadzajacy|nasi-liderzy|our-leaders)$/,
    7,
  ],
  [
    /^(hr|human-resources|kariera|careers?|praca|jobs|pracuj-z-nami|work-with-us|dolacz-do-nas|join-us|mozliwosci-rozwoju|rozwoj-zawodowy|rozwoj-i-kariera|kultura-organizacyjna|our-culture|employer-branding)$/,
    5,
  ],
  [/^(o-nas|about|about-us|o-firmie|company|firma|who-we-are|o-spolce|grupa)$/, 3],
  [/^(media|press|prasa|biuro-prasowe|newsroom|dla-mediow)$/, 2],
];
const LINK_NEGATIVE =
  /(\.(pdf|jpg|png|zip|docx?|xlsx?|pptx?|mp4)$|login|logowanie|koszyk|cart|sklep|shop|produkt|product|oferta-pracy|job-offer|\/jobs\/\d|regulamin|cookies|polityka|privacy|rodo|search|szukaj|\?|#|esg|zrownowazon|sustainab|relacje-inwestorskie|investor|raport|report|aktualnosci\/|news\/|blog\/|artykul|article|-english\/?$)/;

export function scoreLink(url: string, text: string): number {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return 0;
  }
  if (path === "/" || path === "") return 0;
  const folded = foldDiacritics(decodeURIComponent(path));
  if (LINK_NEGATIVE.test(folded)) return 0;
  const segments = folded.split("/").filter(Boolean);
  // Long slug segments are articles, not section pages.
  if (segments.some((sg) => sg.split("-").length > 5)) return 0;
  let score = 0;
  for (const sg of segments) for (const [re, w] of SEGMENT_RULES) if (re.test(sg)) score = Math.max(score, w);
  const t = foldDiacritics(text).trim();
  if (t && t.length <= 40) {
    if (/^(kontakt|contact)/.test(t)) score = Math.max(score, 7);
    if (/(zarzad|management board|leadership team|nasz zespol|our team)/.test(t)) score = Math.max(score, 7);
    if (/(akademia|academy|szkolenia|rozwoj pracownikow|learning)/.test(t)) score = Math.max(score, 9);
    if (/(dla dostawcow|suppliers|zakupy|procurement)/.test(t)) score = Math.max(score, 8);
    if (/^(kariera|careers?|praca)$/.test(t)) score = Math.max(score, 5);
  }
  return score > 0 ? score - Math.min(segments.length, 4) * 0.3 : 0;
}

export function sitemapUrls(xml: string): { urls: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]!.replace(/&amp;/g, "&"));
  return /<sitemapindex/i.test(xml) ? { urls: [], sitemaps: locs } : { urls: locs, sitemaps: [] };
}
