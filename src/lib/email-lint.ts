/**
 * Deterministic checks on a generated or edited email. Pure and unit-tested.
 * "error" findings block approval until fixed (or are auto-repaired once after generation);
 * "warning" findings are shown in the composer.
 */
export type LintFinding = { level: "error" | "warning"; code: string; message: string; excerpt?: string };

export type LintContext = {
  language: "pl" | "en";
  /** All approved facts the email may rely on (profile, programme, recipient, company, signals). */
  factsCorpus: string;
  allowedUrls: string[];
  senderEmail?: string | null;
  isReplyInThread: boolean;
  hasPreviousMessages: boolean;
  tiktokApproved: boolean;
  avoidPhrases: string[];
  kind: "initial" | "follow_up";
};

const CLICHES: { re: RegExp; label: string }[] = [
  { re: /hope (this|my) (e-?mail|message) finds you/i, label: "„I hope this email finds you well”" },
  { re: /hope you('re| are) (doing )?well/i, label: "„Hope you're well”" },
  { re: /mam nadziej[ęe],? [żz]e (ta |moja )?(wiadomo[śs][ćc]|mail)/i, label: "„Mam nadzieję, że wiadomość zastaje…”" },
  { re: /I wanted to reach out|just reaching out|touching base|circling back|just following up/i, label: "pusty zwrot otwierający" },
  { re: /\b(game[- ]changer|revolutionary|cutting[- ]edge|best[- ]in[- ]class|world[- ]class|synerg(y|ies)|unlock your potential)\b/i, label: "przesadny marketing (EN)" },
  { re: /\b(rewolucyjn\w*|przełomow\w*|najlepsz\w* na rynku|unikaln\w* na skal\w*|wyjątkow\w* okazj\w*)\b/i, label: "przesadny marketing (PL)" },
];

const URGENCY: RegExp[] = [
  /\b(only|just) \d+ (spots?|places?|seats?) left\b/i,
  /\blimited (time|spots?|places?|availability)\b/i,
  /\b(act now|don'?t miss|last chance|expires (today|soon)|urgent)\b/i,
  /\b(ostatnie (wolne )?miejsca|tylko dziś|tylko do (końca|piątku|jutra)|pilne|nie przegap|ostatnia szansa|oferta wygasa)\b/i,
];

const GUARANTEES = /\b(guarantee[ds]?|gwarantuj\w*|gwarancj\w*|100\s?%|zero risk|bez ryzyka)\b/i;
const PRIOR_READING = /\b(as you (saw|read|know from) (in )?my (previous|last)|following up on my (previous|last) (e-?mail|message)|jak pisał(a|e)m(\s+wcześniej)?|nawiązując do (mojej )?(poprzedniej|ostatniej) wiadomości|w poprzednim mailu)\b/i;
const FAKE_THREAD_SUBJECT = /^\s*(re|fwd?|odp|pd|aw|wg)\s*:/i;
const URL_RE = /\bhttps?:\/\/[^\s)>\]]+|\bwww\.[^\s)>\]]+/gi;
const EMAIL_RE = /[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;
const NUMBER_RE = /(?<![\p{L}\d])(\d+(?:[.,]\d+)?)\s?(%|proc\w*|percent)?/gu;

function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeNum(n: string): string {
  return n.replace(",", ".").replace(/\.0+$/, "");
}

export function lintEmail(subject: string, body: string, ctx: LintContext): LintFinding[] {
  const out: LintFinding[] = [];
  const text = `${subject}\n${body}`;

  if (!subject.trim()) out.push({ level: "error", code: "subject_empty", message: "Brak tematu." });
  if (subject.length > 78) out.push({ level: "warning", code: "subject_long", message: "Temat jest długi (powyżej 78 znaków)." });
  if (FAKE_THREAD_SUBJECT.test(subject) && !ctx.isReplyInThread) {
    out.push({ level: "error", code: "fake_thread", message: "Temat udaje odpowiedź lub przekazanie („Re:”, „Fwd:”), choć to nie jest prawdziwy wątek." });
  }
  if (/[A-ZĄĆĘŁŃÓŚŹŻ]{6,}/.test(subject) && subject === subject.toUpperCase()) {
    out.push({ level: "warning", code: "subject_caps", message: "Temat pisany wielkimi literami." });
  }
  if (/!{2,}/.test(text)) out.push({ level: "warning", code: "exclaim", message: "Wielokrotne wykrzykniki." });

  for (const c of CLICHES) {
    const m = text.match(c.re);
    if (m) out.push({ level: "warning", code: "cliche", message: `Szablonowy zwrot: ${c.label}.`, excerpt: m[0] });
  }
  for (const phrase of ctx.avoidPhrases) {
    if (phrase.trim() && text.toLowerCase().includes(phrase.trim().toLowerCase())) {
      out.push({ level: "warning", code: "avoid_phrase", message: `Fraza z Twojej listy „unikaj”: „${phrase}”.` });
    }
  }
  for (const re of URGENCY) {
    const m = text.match(re);
    if (m) out.push({ level: "error", code: "urgency", message: "Nieuzasadniona presja czasu lub sztuczna rzadkość.", excerpt: m[0] });
  }
  const g = text.match(GUARANTEES);
  if (g && !ctx.factsCorpus.toLowerCase().includes(g[0].toLowerCase())) {
    out.push({ level: "error", code: "guarantee", message: "Gwarancja lub obietnica wyniku, której nie ma w zatwierdzonych materiałach.", excerpt: g[0] });
  }
  if (PRIOR_READING.test(text) && !ctx.hasPreviousMessages) {
    out.push({ level: "error", code: "prior_reading", message: "Nawiązanie do wcześniejszej wiadomości, której nie było." });
  } else if (PRIOR_READING.test(text) && ctx.kind === "follow_up" && /\b(as you saw|jak (Pan|Pani|Państwo) (widział|czytał))/i.test(text)) {
    out.push({ level: "error", code: "prior_reading", message: "Zakłada, że odbiorca przeczytał poprzednią wiadomość — brak na to dowodu." });
  }

  // URLs: only links from the allowed list.
  const allowed = ctx.allowedUrls.map((u) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase());
  for (const m of text.matchAll(URL_RE)) {
    const u = m[0].replace(/[.,;:!?]+$/, "");
    const norm = u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase();
    if (!allowed.some((a) => norm === a || norm.startsWith(`${a}/`) || norm.startsWith(a))) {
      out.push({ level: "error", code: "url", message: "Link spoza dozwolonej listy.", excerpt: u });
    }
  }
  for (const m of text.matchAll(EMAIL_RE)) {
    if (!ctx.senderEmail || m[0].toLowerCase() !== ctx.senderEmail.toLowerCase()) {
      out.push({ level: "error", code: "email_address", message: "Adres e-mail w treści (dozwolony tylko Twój).", excerpt: m[0] });
    }
  }

  // Numbers and percentages must come from approved facts.
  const corpus = ctx.factsCorpus.replace(/\s+/g, " ");
  const corpusNums = new Set([...corpus.matchAll(NUMBER_RE)].map((m) => normalizeNum(m[1]!)));
  for (const m of body.matchAll(NUMBER_RE)) {
    const n = normalizeNum(m[1]!);
    if (/^(19|20)\d\d$/.test(n)) continue; // years in dates are handled by the model's context
    if (!corpusNums.has(n)) {
      out.push({ level: "error", code: "number", message: "Liczba, której nie ma w zatwierdzonych faktach.", excerpt: m[0].trim() });
    }
  }

  if (/tiktok/i.test(text)) {
    if (!ctx.tiktokApproved) out.push({ level: "error", code: "tiktok", message: "Wzmianka o TikToku bez zatwierdzonego faktu w profilu." });
    if (/tiktok\s+(recommend|endorse|partner|approved|poleca|rekomenduje|współpracuje|partnerem)/i.test(text) || /(partner|klient)\w*\s+tiktok/i.test(text)) {
      out.push({ level: "error", code: "tiktok_endorsement", message: "Sugeruje rekomendację lub współpracę TikToka." });
    }
  }

  const w = words(body);
  const max = ctx.kind === "follow_up" ? 130 : 210;
  if (w > max) out.push({ level: "warning", code: "length", message: `Treść ma ${w} słów — warto skrócić (cel: do ${max}).` });
  if (w < 35 && body.trim()) out.push({ level: "warning", code: "too_short", message: "Treść jest bardzo krótka." });
  if (ctx.language === "pl" && /\b(the|and|with|your)\b/.test(body) && words(body) > 30 && (body.match(/\b(the|and|with|your)\b/g)?.length ?? 0) > 3) {
    out.push({ level: "warning", code: "language_mix", message: "W polskiej treści jest sporo angielskich słów." });
  }
  if (ctx.language === "pl" && /\b(Cześć|Hej)\b/.test(body.slice(0, 40))) {
    out.push({ level: "warning", code: "familiarity", message: "Nieformalne powitanie w pierwszym kontakcie." });
  }
  return out;
}

export function hasBlockingFindings(f: LintFinding[]): boolean {
  return f.some((x) => x.level === "error");
}
