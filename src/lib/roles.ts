/**
 * Who decides, organises, buys or budgets training in a company (PL + EN titles).
 * See docs/research/TRAINING-BUYERS.md for the department map behind these rules.
 *
 * Two separate dimensions:
 *  - category: likely decision-maker / programme organiser or influencer / … (evidence-based, not confirmed authority)
 *  - fn: the department or function the person sits in (HR, L&D, procurement, business leadership, …)
 * Recruiting / talent-acquisition, payroll and R&D titles are explicitly not training buyers.
 */
import { foldDiacritics } from "./normalize.ts";

export type RoleCategory =
  | "decision_maker"
  | "organizer_influencer"
  | "departmental_inbox"
  | "general_routing"
  | "uncertain";
export type RoleFunction =
  | "hr"
  | "learning"
  | "procurement"
  | "business_leadership"
  | "transformation"
  | "people_culture"
  | "other";

export type RoleAssessment = {
  category: RoleCategory;
  fn: RoleFunction;
  relevant: boolean;
  label: string; // short human label of the matched rule
  excluded?: string; // why a title is not a development buyer
};

export const FUNCTION_LABEL: Record<RoleFunction, string> = {
  hr: "HR / People",
  learning: "Szkolenia i rozwój (L&D)",
  procurement: "Zakupy",
  business_leadership: "Kierownictwo biznesu",
  transformation: "Transformacja / zmiana",
  people_culture: "Kultura i zaangażowanie",
  other: "Inne",
};

type Rule = { re: RegExp; category: RoleCategory; fn: RoleFunction; label: string };

/** Development of people, not of products or markets. */
const PEOPLE_DEV =
  "rozwoj\\w* (pracownik\\w*|organizacj\\w*|talent\\w*|kompetencj\\w*|przywodztw\\w*|kadr\\w*|ludzi|liderow|menedzer\\w*|osobist\\w*|zespol\\w*)";

// Matching runs on diacritic-folded, lower-cased text.
const EXCLUDE: { re: RegExp; label: string }[] = [
  {
    re: /\b(talent acquisition|recruit\w*|rekrut\w*|sourcer|talent sourcing|headhunt\w*)\b/,
    label: "Rekrutacja / Talent Acquisition",
  },
  { re: /\b(employer branding)\b/, label: "Employer branding" },
  {
    re: /\b(payroll|plac(e|owy|owa|owe|owych|owym)?|compensation|benefit\w*|c&b|reward)\b/,
    label: "Płace / wynagrodzenia",
  },
  {
    re: /\b(badan\w* i rozwoj\w*|research (and|&) development|r ?& ?d|rozwoj\w* (produkt\w*|biznes\w*|sprzedaz\w*|technolog\w*|oprogramowani\w*|rynk\w*)|(product|business|software|technical|market) development|developer)\b/,
    label: "R&D / rozwój biznesu (nie rozwój ludzi)",
  },
  // Retail / merchandise buying is about goods, not services such as training.
  {
    re: /\b(merchandis\w*|kupiec (asortyment\w*|towar\w*|branzy|produkt\w*)|buyer (fashion|food|fresh|grocery|non-food|apparel))\b/,
    label: "Zakupy towarów (nie usług)",
  },
];

const ALSO_DEV = new RegExp(
  `\\b(learning|l&d|szkolen\\w*|training|akademi\\w*|academy|people development|talent development|leadership development|${PEOPLE_DEV})`,
);

/** Procurement context in which training is bought: indirect spend, services, HR / professional services. */
const INDIRECT =
  "(indirect|posredni\\w*|nieprodukcyjn\\w*|non-?production|uslug\\w*|services?|hr|professional|marketing|szkolen\\w*|training|people|consulting|doradz\\w*)";

const RULES: Rule[] = [
  // --- HR / People / Learning leadership: owns the training plan and budget ----------------------
  {
    re: /\b(chief learning officer|clo)\b/,
    category: "decision_maker",
    fn: "learning",
    label: "Szef funkcji L&D",
  },
  {
    re: /\b(chief (people|human resources?|hr|talent) officer|chro)\b/,
    category: "decision_maker",
    fn: "hr",
    label: "Szef funkcji HR/People",
  },
  {
    re: /\b(vp|vice president|svp|evp)\b.*\b(hr|human resources|people|talent|learning|culture)\b/,
    category: "decision_maker",
    fn: "hr",
    label: "VP HR/People",
  },
  // --- L&D / academy leadership -----------------------------------------------------------------
  {
    re: new RegExp(
      `\\b(head|director|dyrektor\\w*|lead)\\b.*\\b(learning|l&d|l ?& ?d|training|szkolen\\w*|leadership development|talent (development|management)|people development|organi[sz]ational development|${PEOPLE_DEV}|akademi\\w*|academy)`,
    ),
    category: "decision_maker",
    fn: "learning",
    label: "Kierownictwo L&D / akademii",
  },
  {
    re: /\b(kierownik\w*|manager)\b.*\b(akademi\w*|academy)\b/,
    category: "decision_maker",
    fn: "learning",
    label: "Kierownik akademii",
  },
  {
    re: /\b(head|director|dyrektor\w*)\b.*\b(hr|human resources|people|personal\w*|kadr\w*|zasobow ludzkich|zarzadzania zasobami ludzkimi|people & culture|people and culture|kapitalu ludzkiego)\b/,
    category: "decision_maker",
    fn: "hr",
    label: "Dyrektor HR / People",
  },
  {
    re: /\b(dyrektor personalny|dyrektorka personalna|dyrektor ds\.? personalnych|dyrektor ds\.? hr)\b/,
    category: "decision_maker",
    fn: "hr",
    label: "Dyrektor personalny",
  },
  {
    re: /\b(czlon\w* zarzadu|wiceprezes\w*|vice-?president)\b.*\b(hr|personal\w*|ludzi|kadr\w*|zasob\w* ludzk\w*|people)\b/,
    category: "decision_maker",
    fn: "hr",
    label: "Zarząd ds. HR",
  },
  {
    re: /\b(hr director|people director|people & culture director|director of people|director of hr|hr lead|head of people|head of hr)\b/,
    category: "decision_maker",
    fn: "hr",
    label: "HR / People Director",
  },
  // --- Transformation / change (the human side of AI adoption) ----------------------------------
  {
    re: /\b(chief transformation officer|chief ai officer|chief digital officer)\b/,
    category: "decision_maker",
    fn: "transformation",
    label: "Szef transformacji / AI",
  },
  {
    re: /\b(head|director|dyrektor\w*)\b.*\b(transformac\w*|transformation|change|ds\.? zmian\w*|zarzadzani\w* zmian\w*|ai adoption|wdrozeni\w* ai|operational excellence|doskonalosci operacyjnej)\b/,
    category: "decision_maker",
    fn: "transformation",
    label: "Kierownictwo transformacji / zmiany",
  },
  // --- Business leaders who sponsor manager / team development and hold budgets ----------------
  {
    re: /\b(chief operating officer|coo|dyrektor\w* operacyjn\w*|operations director|director of operations|head of operations)\b/,
    category: "decision_maker",
    fn: "business_leadership",
    label: "Dyrektor operacyjny",
  },
  {
    re: /\b(site (lead|leader|head|director)|head of (centre|center|site)|(center|centre|site) director|dyrektor\w* (centrum|zakladu|fabryki|zakladow)|plant (director|manager)|factory director|general manager|managing director|country manager|dyrektor\w* generaln\w*|dyrektor\w* zarzadzajac\w*)\b/,
    category: "decision_maker",
    fn: "business_leadership",
    label: "Szef ośrodka / dyrektor zarządzający",
  },
  // --- Organisers / influencers -----------------------------------------------------------------
  {
    re: /\b(learning (and|&) development|l&d|l ?& ?d)\b/,
    category: "organizer_influencer",
    fn: "learning",
    label: "L&D",
  },
  {
    re: new RegExp(
      `\\b(leadership development|talent development|people development|organi[sz]ational development|learning|training|trainer|szkolen\\w*|trener\\w*|${PEOPLE_DEV}|akademi\\w*|academy|onboarding)`,
    ),
    category: "organizer_influencer",
    fn: "learning",
    label: "Szkolenia i rozwój",
  },
  {
    re: /\b(hr business partner|hrbp|business partner hr|partner biznesowy hr)\b/,
    category: "organizer_influencer",
    fn: "hr",
    label: "HR Business Partner",
  },
  {
    re: /\b(talent management|talent manager|employee (engagement|experience)|people experience|zaangazowani\w* pracownik\w*|wellbeing|well-being|culture (manager|lead)|kultur\w* organizacyjn\w*)\b/,
    category: "organizer_influencer",
    fn: "people_culture",
    label: "Talent / kultura / zaangażowanie",
  },
  {
    re: /\b(change manager|change management|kierownik\w* ds\.? zmian\w*|zarzadzani\w* zmian\w*|transformation (manager|lead|partner)|ai (adoption|enablement) (lead|manager))\b/,
    category: "organizer_influencer",
    fn: "transformation",
    label: "Zarządzanie zmianą",
  },
  {
    re: /\b(hr manager|people manager|people partner|kierownik\w* (dzialu )?(hr|kadr\w*|personaln\w*)|menedzer\w* (hr|ds\.? personalnych)|hr generalist|specjalist\w* ds\.? (hr|personalnych|rozwoju))\b/,
    category: "organizer_influencer",
    fn: "hr",
    label: "HR (kierownik / specjalista)",
  },
  // --- Procurement: indirect / services buyers run RFPs and supplier onboarding for training ------
  {
    re: new RegExp(
      `\\b(category (manager|lead|buyer)|kategori\\w*|buyer|kupiec|zakup\\w*|procurement|purchasing|sourcing)\\b.*\\b${INDIRECT}\\b|\\b${INDIRECT}\\b.*\\b(category (manager|lead|buyer)|buyer|kupiec|procurement|purchasing|sourcing)\\b`,
    ),
    category: "organizer_influencer",
    fn: "procurement",
    label: "Zakupy pośrednie / usług",
  },
  {
    re: /\b(chief procurement officer|cpo procurement)\b|\b(head|director|dyrektor\w*|kierownik\w*|manager|lead)\b.*\b(procurement|purchasing|zakup\w*|zaopatrzeni\w*|sourcing)\b|\b(procurement|purchasing|sourcing) (director|head|manager|lead)\b/,
    category: "organizer_influencer",
    fn: "procurement",
    label: "Kierownictwo zakupów",
  },
];

export function assessRole(title: string | null | undefined): RoleAssessment {
  if (!title?.trim())
    return { category: "uncertain", fn: "other", relevant: false, label: "Brak stanowiska" };
  const t = foldDiacritics(title).replace(/\s+/g, " ");
  for (const ex of EXCLUDE) {
    if (ex.re.test(t) && !ALSO_DEV.test(t))
      return { category: "uncertain", fn: "other", relevant: false, label: ex.label, excluded: ex.label };
  }
  for (const r of RULES) {
    if (r.re.test(t)) return { category: r.category, fn: r.fn, relevant: true, label: r.label };
  }
  return { category: "uncertain", fn: "other", relevant: false, label: "Rola niepewna" };
}

/** Keywords used by the crawler to find candidate pages and nearby titles. */
export const ROLE_KEYWORDS = [
  "learning",
  "l&d",
  "training",
  "development",
  "talent",
  "people",
  "hr",
  "human resources",
  "culture",
  "academy",
  "szkolen",
  "rozwoj",
  "akademia",
  "personalny",
  "kadr",
  "zakupy",
  "procurement",
  "dyrektor",
];

/**
 * Reorders candidates so each department is represented before any department gets a second slot
 * (HR, L&D, procurement and business leaders are different routes to the same budget).
 * Order inside a department is kept, and departments appear in the order of their best candidate.
 */
export function spreadAcrossFunctions<T>(items: T[], fnOf: (item: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const k = fnOf(it);
    const g = groups.get(k);
    if (g) g.push(it);
    else groups.set(k, [it]);
  }
  const out: T[] = [];
  for (let round = 0; out.length < items.length; round++) {
    for (const g of groups.values()) if (round < g.length) out.push(g[round] as T);
  }
  return out;
}

/** Department implied by a mailbox type (see classifyMailbox). */
export function mailboxFunction(mailbox: string | null | undefined): RoleFunction {
  return mailbox === "development"
    ? "learning"
    : mailbox === "hr"
      ? "hr"
      : mailbox === "procurement"
        ? "procurement"
        : "other";
}

/** Best department guess: the title first, then the department label, then the mailbox. */
export function functionFor(
  title: string | null | undefined,
  department: string | null | undefined,
  mailbox?: string | null,
): RoleFunction {
  const fromTitle = assessRole(title).fn;
  if (fromTitle !== "other") return fromTitle;
  const fromDept = assessRole(department).fn;
  if (fromDept !== "other") return fromDept;
  if (department) {
    const d = foldDiacritics(department);
    if (/\b(zakup\w*|procurement|purchasing|zaopatrzeni\w*|sourcing)\b/.test(d)) return "procurement";
    if (/\b(hr|kadr\w*|personal\w*|people|zasob\w* ludzk\w*)\b/.test(d)) return "hr";
  }
  return mailboxFunction(mailbox);
}
