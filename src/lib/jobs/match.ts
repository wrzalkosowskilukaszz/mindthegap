/**
 * Free, explainable job matching (no AI): role keywords in the title, your CV and topic keywords in the
 * description, location, language requirements and seniority. Every point added or taken away comes
 * with a reason the owner can read, so the score is never a black box.
 */

export type RoleFamily = "learning" | "people" | "coaching" | "creative";
export type LocationPref = "warsaw" | "remote_poland" | "eu_relocation" | "poland_other";
export type WorkType = "full_time" | "freelance" | "part_time";

export type CareerPrefs = {
  roleFamilies: RoleFamily[];
  locations: LocationPref[];
  languages: string[]; // ISO 639-1: "en", "pl", …
  workTypes: WorkType[];
  cvKeywords: string[];
  extraKeywords: string[];
  excludeKeywords: string[];
};

export type JobInput = {
  title: string;
  description: string;
  location: string | null;
  countries?: string[]; // ISO 3166 alpha-2 when the source states them
  workplace?: "remote" | "hybrid" | "onsite" | "unknown";
  employmentType?: string | null;
  companyName: string;
  companySector?: string | null;
  favourite?: boolean;
  postedAt?: Date | null;
};

export type Region =
  | "warsaw"
  | "poland"
  | "remote_ok"
  | "remote_unclear"
  | "eu"
  | "europe"
  | "non_eu"
  | "unknown";

export type MatchResult = {
  score: number;
  eligible: boolean;
  region: Region;
  reasons: { text: string; tone: "good" | "warn" | "bad" }[];
  requiredLanguages: string[];
  hits: string[];
  /** The role family the title belongs to; null when the title is not one of the owner's roles. */
  role: RoleFamily | null;
};

// ------------------------------------------------------------------------------------------------
// Role families: title patterns (EN + PL) and topic words looked for in descriptions
// ------------------------------------------------------------------------------------------------

export const FAMILY_LABEL: Record<RoleFamily, string> = {
  learning: "L&D / rozwój liderów",
  people: "People & organizacja",
  coaching: "Coaching / doradztwo",
  creative: "Media, rozrywka, tech",
};

const TITLE: Record<RoleFamily, RegExp> = {
  // Only "learning" is checked with learningTitle() below: L&D has to be the job, not a word in it.
  learning:
    /\b(l&d|l ?& ?od|learning|instructional|e-?learning|curriculum|leadership development|talent development|people development|employee development|szkole[nń]\w*|szkoleniow\w*|metodyk\w*|rozw[oó]j\w* (pracownik|kompetencji|talent|lider|organizac)\w*)(?![\p{L}\d])/iu,
  people:
    /\b(people|human resources|hrbp|hr business partner|hr manager|hr director|head of hr|chief people|organi[sz]ational (development|effectiveness|design)|culture|(employee|people|staff) engagement|engagement (&|and) culture|employee experience|talent management|change management|change manager|change lead|(people|cultural|organi[sz]ational) transformation|well-?being|diversity|inclusion|dei|kadr\w*|personaln\w*|zasob\w* ludzki\w*|hr)\b/i,
  coaching:
    /\b(coach\w*|mentor\w*|facilitator|workshop|team effectiveness|(leadership|organi[sz]ational|people|hr|change|learning|culture|talent) (consultant|advisor|partner)|konsultant\w* (hr|ds\. (rozwoju|szkoleń)))\b/i,
  creative:
    /\b(program(me)? manager|community|content|partnerships?|creative|producer|production|events?|communications?|brand|creator|talent relations|trust (&|and) safety|policy|culture lead|operations manager|project manager)\b/i,
};

/**
 * Trainer and facilitator titles that are L&D work (soft skills, leadership, corporate training), as
 * opposed to "trainer" in a trade (product, pharma, IT, fitness, driving …).
 */
const LEARNING_TRAINER =
  /\b((soft[- ]skills?|corporate|business|leadership|management|managerial|behaviou?ral|internal|people|hr|learning|development|workshop|program(me)?) (trainer|training|facilitator)|(training|trainer) (manager|specialist|coordinator|lead|partner|consultant|designer|developer|expert|officer|director|programmes?|programs?|business partner)|training (&|and|i) (development|rozw[oó]j\w*)|head of (training|learning|l&d|development)|(learning|training) (&|and) (talent|organi[sz]ational|people|leadership)|facilitator|facylitator\w*|trener\w* (biznesu|biznesow\w*|wewn[eę]trzn\w*|umiej[eę]tno[sś]ci\w*|mi[eę]kkich|kompetencji|rozwoju|lider\w*|zarz[aą]dzania))(?![\p{L}\d])/iu;

/**
 * Fields where "learning", "training" or "trainer" means teaching a trade, a product or a subject:
 * an offer with one of these in the title is not an L&D role (pharma trainer, clinical educator,
 * surgeon, sales trainer, IT trainer, machine learning, language teacher …).
 */
const NOT_LEARNING =
  /\b(clinical|clinic|pharma\w*|medical|medicine|biotech\w*|surg\w*|nurs\w*|physician|doctor|dental|dentist|veterinar\w*|patient|hospital|health ?care|laborator\w*|lab|drug|therap\w*|physio\w*|radiolog\w*|oncolog\w*|gmp|gxp|quality|compliance|regulatory|safety|hse|ehs|bhp|sales|selling|product|technical|technician|software|(web|front-?end|back-?end|full-?stack|mobile|game|java|python) (developer|engineer)|engineering|machine learning|deep learning|reinforcement learning|data|cloud|aws|azure|salesforce|sap|crm|erp|excel|cyber\w*|security|devops|driving|driver|flight|pilot|aviation|cabin crew|airline|fitness|gym|sport\w*|yoga|swim\w*|dog|animal|forklift|operator|warehouse|logistics|manufacturing|production|maintenance|welding|electric\w*|mechanic\w*|retail|store|call cent(er|re)|contact cent(er|re)|customer service|teacher|tutor|lecturer|professor|school|kindergarten|early years|learning support|special (educational )?needs|language|english|german|spanish|french|lekarz\w*|chirurg\w*|farmac\w*|medyczn\w*|kliniczn\w*|piel[eę]gniar\w*|sprzeda\w*|handlow\w*|techniczn\w*|in[żz]ynier\w*|programist\w*|kierowc\w*|magazyn\w*|produkcj\w*|nauczyciel\w*|j[eę]zyk\w*|lektor\w*|przedszkol\w*|szk[oó][lł]\w* (podstawow|[sś]redni)\w*)(?![\p{L}\d])/iu;
// Short capitals that are words in other cases ("it", "ai").
const NOT_LEARNING_CAPS = /\b(IT|AI|ML|QA|R&D)\b/;

/** True when the title names an L&D role (instructional design, learning, L&D, corporate training …). */
export function learningTitle(title: string): boolean {
  if (NOT_LEARNING.test(title) || NOT_LEARNING_CAPS.test(title)) return false;
  return TITLE.learning.test(title) || LEARNING_TRAINER.test(title);
}

function familyOfTitle(title: string, families: RoleFamily[], mediaCompany: boolean): RoleFamily | null {
  for (const f of ["learning", "people", "coaching", "creative"] as const) {
    if (!families.includes(f)) continue;
    if (f === "learning" ? !learningTitle(title) : !TITLE[f].test(title)) continue;
    if (f === "creative" && !mediaCompany) continue;
    return f;
  }
  return null;
}

const TOPICS: Record<RoleFamily, string[]> = {
  learning: [
    "learning",
    "l&d",
    "training",
    "facilitation",
    "workshop",
    "leadership development",
    "instructional design",
    "e-learning",
    "learning experience",
    "lms",
    "onboarding",
    "upskilling",
    "reskilling",
    "academy",
    "development programs",
    "coaching",
    "szkolenia",
    "rozwój",
    "warsztaty",
  ],
  people: [
    "people",
    "culture",
    "engagement",
    "organizational development",
    "organisational development",
    "change management",
    "talent management",
    "performance management",
    "employee experience",
    "hr business partner",
    "succession",
    "dei",
    "well-being",
    "kultura organizacyjna",
    "zaangażowanie",
  ],
  coaching: [
    "coaching",
    "team effectiveness",
    "facilitation",
    "workshops",
    "consulting",
    "advisory",
    "leadership",
    "team dynamics",
    "stakeholder",
    "mentoring",
  ],
  creative: [
    "streaming",
    "entertainment",
    "media",
    "content",
    "creators",
    "community",
    "production",
    "storytelling",
    "brand",
    "partnerships",
  ],
};

const MEDIA_TECH_SECTORS = new Set(["telecom_media", "technology"]);
// Highest score for an offer whose title is not one of the owner's roles (below every list threshold).
const NO_ROLE_CAP = 20;

// Roles that share a word with the families but are not what the owner is looking for.
const OFF_TARGET =
  /\b(recruit\w*|talent acquisition|sourcer|sourcing|payroll|p[łl]ac\w*|rekrutac\w*|rekruter\w*|benefits administrator|(software|frontend|front-end|backend|back-end|full[- ]?stack|java|python|\.net|ios|android|web|game|data|platform|cloud|devops|ml|machine learning|site reliability|qa|test) (developer|engineer|architect)|engineering manager|accountant|ksi[eę]gow\w*|sales representative|account executive|driver|kierowc\w*|warehouse|magazyn\w*|nurse|piel[eę]gniar\w*|surg\w*|physician|doctor|lekarz\w*|chirurg\w*|pharmacist|farmaceut\w*|dentist|veterinar\w*|physiotherap\w*|medical (representative|sales|science liaison)|pharmaceutical sales|teacher|nauczyciel\w*|personal trainer|fitness|gym|restaurant|kitchen|chef|barista|clinical|physics|math|ai (training|trainer|tutor)|data annotat\w*|driving instructor|swim\w*|lifeguard|retail store)\b/i;
const JUNIOR =
  /\b(junior|intern|internship|trainee|working student|werkstudent|praktyk\w*|sta[zż]\w*|asystent\w*|assistant)\b/i;

// ------------------------------------------------------------------------------------------------
// Locations
// ------------------------------------------------------------------------------------------------

const EU: Record<string, string[]> = {
  AT: ["austria", "österreich", "vienna", "wien", "graz", "linz"],
  BE: ["belgium", "belgië", "belgique", "brussels", "bruxelles", "antwerp", "ghent"],
  BG: ["bulgaria", "sofia"],
  HR: ["croatia", "zagreb"],
  CY: ["cyprus", "limassol", "nicosia"],
  CZ: ["czech", "czechia", "prague", "praha", "brno"],
  DK: ["denmark", "copenhagen", "aarhus"],
  EE: ["estonia", "tallinn"],
  FI: ["finland", "helsinki", "espoo"],
  FR: ["france", "paris", "lyon", "marseille", "toulouse", "lille", "nantes"],
  DE: [
    "germany",
    "deutschland",
    "niemcy",
    "berlin",
    "munich",
    "münchen",
    "hamburg",
    "frankfurt",
    "cologne",
    "köln",
    "düsseldorf",
    "stuttgart",
    "leipzig",
    "dresden",
    "hannover",
    "nuremberg",
    "nürnberg",
    "bonn",
    "essen",
  ],
  GR: ["greece", "athens", "thessaloniki"],
  HU: ["hungary", "budapest"],
  IE: ["ireland", "dublin", "cork", "galway"],
  IT: ["italy", "italia", "milan", "milano", "rome", "roma", "turin", "torino", "bologna"],
  LV: ["latvia", "riga"],
  LT: ["lithuania", "vilnius", "kaunas"],
  LU: ["luxembourg"],
  MT: ["malta", "valletta"],
  NL: ["netherlands", "nederland", "holland", "amsterdam", "rotterdam", "utrecht", "the hague", "eindhoven"],
  PT: ["portugal", "lisbon", "lisboa", "porto"],
  RO: ["romania", "bucharest", "bucurești", "cluj"],
  SK: ["slovakia", "bratislava", "košice"],
  SI: ["slovenia", "ljubljana"],
  ES: ["spain", "españa", "madrid", "barcelona", "valencia", "seville", "malaga", "málaga"],
  SE: ["sweden", "stockholm", "gothenburg", "göteborg", "malmö"],
};
const EUROPE_NON_EU: Record<string, string[]> = {
  CH: [
    "switzerland",
    "schweiz",
    "suisse",
    "zurich",
    "zürich",
    "geneva",
    "genève",
    "basel",
    "lausanne",
    "zug",
  ],
  NO: ["norway", "oslo", "bergen"],
  IS: ["iceland", "reykjavik"],
};
const NON_EU =
  /\b(united kingdom|\buk\b|england|scotland|wales|london|manchester|edinburgh|birmingham|bristol|united states|\busa?\b|new york|san francisco|los angeles|seattle|chicago|boston|austin|texas|california|canada|toronto|vancouver|montreal|india|bangalore|bengaluru|hyderabad|mumbai|singapore|australia|sydney|melbourne|brazil|são paulo|mexico|japan|tokyo|china|hong kong|dubai|uae|israel|tel aviv|turkey|istanbul|ukraine|kyiv|serbia|belgrade|philippines|south africa|argentina|colombia|egypt)\b/i;
const POLAND_OTHER =
  /\b(krak[oó]w|cracow|wroc[lł]aw|pozna[nń]|gda[nń]sk|gdynia|sopot|tr[oó]jmiasto|tricity|[lł][oó]d[zź]|katowice|szczecin|lublin|bydgoszcz|bia[lł]ystok|rzesz[oó]w|toru[nń]|opole|kielce|gliwice)\b/i;
const WARSAW = /\b(warszaw\w*|warsaw|varsovie)\b/i;
const POLAND = /\b(poland|polska|polsce|pl)\b/i;
const REMOTE = /\b(remote|zdaln\w*|home office|work from home|anywhere|distributed|telecommut\w*)\b/i;
const HYBRID = /\b(hybrid|hybrydow\w*)\b/i;
const REMOTE_OK_SCOPE =
  /\b(emea|europe|european union|\beu\b|cet|cest|poland|polska|worldwide|global|anywhere)\b/i;
const REMOTE_BAD_SCOPE =
  /\b(us only|usa only|united states|u\.s\.|uk only|united kingdom|canada|latam|americas|apac|north america)\b/i;

// Country codes some career sites put first ("CAN - Mississauga", "POL - Warszawa").
const EU_ISO3 =
  /^(POL|DEU|FRA|ESP|ITA|NLD|BEL|AUT|PRT|IRL|SWE|DNK|FIN|CZE|SVK|HUN|ROU|BGR|GRC|HRV|SVN|EST|LVA|LTU|LUX|MLT|CYP)\b/;
const NON_EU_ISO3 =
  /^(USA|CAN|GBR|IND|MEX|BRA|AUS|CHN|JPN|SGP|ARE|ISR|TUR|ZAF|ARG|COL|PHL|KOR|MYS|IDN|EGY|NGA|KEN|SAU|QAT|NZL|CHL|PER|THA|VNM|UKR|SRB)\b/;

function countryOf(text: string): string | null {
  const t = text.toLowerCase();
  for (const [code, words] of Object.entries(EU)) if (words.some((w) => t.includes(w))) return code;
  return null;
}

export function classifyLocation(job: Pick<JobInput, "location" | "countries" | "workplace">): Region {
  const loc = job.location ?? "";
  const countries = (job.countries ?? []).map((c) => c.toUpperCase());
  const remote = job.workplace === "remote" || REMOTE.test(loc);
  if (WARSAW.test(loc)) return "warsaw";
  if (/^POL\b/.test(loc.trim())) return remote ? "remote_ok" : "poland";
  if (EU_ISO3.test(loc.trim()) && !remote) return "eu";
  if (NON_EU_ISO3.test(loc.trim()) && !/;/.test(loc)) return "non_eu";
  if (remote) {
    if (countries.length) {
      if (countries.includes("PL")) return "remote_ok";
      if (countries.some((c) => c in EU)) return "remote_ok";
      return "non_eu";
    }
    if (REMOTE_BAD_SCOPE.test(loc) && !REMOTE_OK_SCOPE.test(loc)) return "non_eu";
    if (REMOTE_OK_SCOPE.test(loc) || POLAND.test(loc)) return "remote_ok";
    if (NON_EU.test(loc)) return "non_eu";
    return "remote_unclear";
  }
  if (countries.includes("PL") || POLAND.test(loc) || POLAND_OTHER.test(loc)) return "poland";
  if (countries.some((c) => c in EU) || countryOf(loc)) return "eu";
  if (
    countries.some((c) => c in EUROPE_NON_EU) ||
    Object.values(EUROPE_NON_EU)
      .flat()
      .some((w) => loc.toLowerCase().includes(w))
  )
    return "europe";
  if (countries.length || NON_EU.test(loc)) return "non_eu";
  return "unknown";
}

// ------------------------------------------------------------------------------------------------
// Languages: required languages and the language the ad itself is written in
// ------------------------------------------------------------------------------------------------

export const LANG_NAMES: Record<string, RegExp> = {
  de: /\b(german|deutsch\w*|niemieck\w*)\b/i,
  fr: /\b(french|français|francusk\w*)\b/i,
  nl: /\b(dutch|nederlands|niderlandzk\w*)\b/i,
  es: /\b(spanish|español|hiszpańsk\w*)\b/i,
  it: /\b(italian|italiano|włosk\w*)\b/i,
  sv: /\b(swedish|svenska|szwedzk\w*)\b/i,
  da: /\b(danish|dansk|duńsk\w*)\b/i,
  fi: /\b(finnish|suomi|fińsk\w*)\b/i,
  cs: /\b(czech|čeština|czesk\w*)\b/i,
  hu: /\b(hungarian|magyar|węgiersk\w*)\b/i,
  pt: /\b(portuguese|português|portugalsk\w*)\b/i,
  ro: /\b(romanian|română|rumuńsk\w*)\b/i,
  pl: /\b(polish|polski\w*|język\w* polsk\w*)\b/i,
  en: /\b(english|angielsk\w*)\b/i,
  uk: /\b(ukrainian|ukraińsk\w*)\b/i,
  ru: /\b(russian|rosyjsk\w*)\b/i,
};
export const WRITTEN_IN: Record<string, string> = {
  de: "po niemiecku",
  fr: "po francusku",
  nl: "po niderlandzku",
  es: "po hiszpańsku",
  pl: "po polsku",
  en: "po angielsku",
};
export const LANGUAGE_LABEL: Record<string, string> = {
  de: "niemiecki",
  fr: "francuski",
  nl: "niderlandzki",
  es: "hiszpański",
  it: "włoski",
  sv: "szwedzki",
  da: "duński",
  fi: "fiński",
  cs: "czeski",
  hu: "węgierski",
  pt: "portugalski",
  ro: "rumuński",
  pl: "polski",
  en: "angielski",
  uk: "ukraiński",
  ru: "rosyjski",
};
const REQUIRED_NEAR =
  /(fluent|fluency|native|mother tongue|business[- ]level|proficien\w*|excellent|very good|strong|advanced|c1|c2|required|must|mandatory|essential|flie(ss|ß)end|verhandlungssicher|biegł\w*|bardzo dobr\w*|wymagan\w*|komunikatywn\w*)/i;

/** Languages the ad says you must speak (only when a requirement word is next to the language). */
export function requiredLanguages(description: string): string[] {
  const out = new Set<string>();
  const sentences = description.split(/(?<=[.!?;\n•])\s+/);
  for (const s of sentences) {
    if (!REQUIRED_NEAR.test(s)) continue;
    for (const [code, re] of Object.entries(LANG_NAMES)) if (re.test(s)) out.add(code);
  }
  return [...out];
}

const STOP: Record<string, string[]> = {
  de: [
    "und",
    "der",
    "die",
    "das",
    "mit",
    "für",
    "wir",
    "sie",
    "ihre",
    "eine",
    "bei",
    "auf",
    "sind",
    "werden",
  ],
  fr: ["et", "les", "des", "pour", "avec", "nous", "vous", "une", "dans", "sur", "votre"],
  nl: ["en", "het", "een", "voor", "met", "wij", "jij", "van", "zijn", "jouw"],
  es: ["y", "los", "las", "para", "con", "nosotros", "una", "en", "del", "tu"],
  pl: ["i", "w", "na", "z", "do", "się", "oraz", "dla", "jest", "nasz", "będziesz"],
  en: ["and", "the", "for", "with", "you", "our", "will", "are", "your", "this"],
};

/** The language the ad is written in, from common short words (good enough to spot German ads). */
export function adLanguage(text: string): string {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 20) return "unknown";
  let best = "unknown";
  let bestN = 0;
  for (const [lang, stop] of Object.entries(STOP)) {
    const set = new Set(stop);
    const n = words.reduce((a, w) => a + (set.has(w) ? 1 : 0), 0);
    if (n > bestN) {
      best = lang;
      bestN = n;
    }
  }
  return bestN / words.length > 0.04 ? best : "unknown";
}

// ------------------------------------------------------------------------------------------------
// CV keywords
// ------------------------------------------------------------------------------------------------

const CV_VOCAB = [
  ...new Set([
    ...Object.values(TOPICS).flat(),
    "facilitator",
    "trainer",
    "coach",
    "leadership",
    "management",
    "team building",
    "design thinking",
    "agile",
    "okr",
    "feedback",
    "communication",
    "presentation",
    "public speaking",
    "program management",
    "project management",
    "stakeholder management",
    "needs analysis",
    "training needs",
    "evaluation",
    "kirkpatrick",
    "blended learning",
    "microlearning",
    "storytelling",
    "content creation",
    "community management",
    "trust and safety",
    "operations",
    "remote teams",
    "hybrid work",
    "psychological safety",
    "emotional intelligence",
    "conflict resolution",
    "negotiation",
    "mentoring",
    "assessment center",
    "development center",
    "360",
    "competency model",
    "tiktok",
    "startup",
    "scale-up",
    "fast-growing",
    "international",
    "multicultural",
  ]),
];

/** Topic words from the CV text: known skills and phrases that actually appear in it. */
export function extractCvKeywords(cvText: string): string[] {
  const t = ` ${cvText.toLowerCase().replace(/\s+/g, " ")} `;
  return CV_VOCAB.filter((k) => t.includes(` ${k}`) || t.includes(`${k} `)).slice(0, 40);
}

// ------------------------------------------------------------------------------------------------
// Score
// ------------------------------------------------------------------------------------------------

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const has = (text: string, word: string) => {
  const w = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${w}`, "iu").test(text);
};

export function scoreJob(job: JobInput, prefs: CareerPrefs, now = new Date()): MatchResult {
  const reasons: MatchResult["reasons"] = [];
  const title = job.title.trim();
  const desc = job.description.toLowerCase();
  let score = 0;

  // Location first: some places are simply out.
  const region = classifyLocation(job);
  const loc = prefs.locations;
  let eligible = true;
  if (region === "warsaw") {
    if (loc.includes("warsaw")) {
      score += 15;
      reasons.push({
        text: `Warszawa${job.workplace === "hybrid" || HYBRID.test(job.location ?? "") ? " · hybrydowo" : ""}`,
        tone: "good",
      });
    } else eligible = false;
  } else if (region === "remote_ok") {
    if (loc.includes("remote_poland")) {
      score += 14;
      reasons.push({ text: "Zdalnie, z Polski", tone: "good" });
    } else eligible = false;
  } else if (region === "remote_unclear") {
    if (loc.includes("remote_poland")) {
      score += 4;
      reasons.push({ text: "Zdalnie — sprawdź, czy z Polski", tone: "warn" });
    } else eligible = false;
  } else if (region === "poland") {
    if (loc.includes("poland_other")) {
      score += 8;
      reasons.push({ text: job.location ?? "Polska", tone: "good" });
    } else eligible = false;
  } else if (region === "eu") {
    if (loc.includes("eu_relocation")) {
      score += 6;
      reasons.push({ text: `${shortPlace(job.location) ?? "UE"} (przeprowadzka)`, tone: "warn" });
    } else eligible = false;
  } else if (region === "europe") {
    if (loc.includes("eu_relocation")) {
      score += 3;
      reasons.push({ text: `${job.location ?? "Europa"} (poza UE)`, tone: "warn" });
    } else eligible = false;
  } else if (region === "non_eu") eligible = false;
  else if (
    /\b(poland|polska|polsce|warsaw|warszaw\w*|emea|europe|europa|european union)\b/i.test(job.description)
  ) {
    reasons.push({ text: "Miejsce niejasne — ogłoszenie wspomina Polskę lub Europę", tone: "warn" });
  } else eligible = false; // no place and no hint of Europe: most likely outside the EU

  // Role: the title says the most.
  const families = prefs.roleFamilies;
  const mediaCompany = Boolean(
    job.favourite || (job.companySector && MEDIA_TECH_SECTORS.has(job.companySector)),
  );
  const titleHit = familyOfTitle(title, families, mediaCompany);
  if (titleHit) {
    score += { learning: 48, people: 40, coaching: 36, creative: 30 }[titleHit];
    reasons.push({ text: FAMILY_LABEL[titleHit], tone: "good" });
  }
  if (OFF_TARGET.test(title)) {
    score -= 35;
    reasons.push({ text: "Inny profil stanowiska", tone: "bad" });
  }

  // Description: your CV words, your extra words and the topics of the chosen families.
  const words = [
    ...new Set([
      ...prefs.cvKeywords,
      ...prefs.extraKeywords,
      ...families.flatMap((f) => (f === "creative" && !mediaCompany ? [] : TOPICS[f])),
    ]),
  ].filter((w) => w.trim().length > 1);
  const hits = words.filter((w) => has(desc, w) || has(title.toLowerCase(), w));
  const cvHits = hits.filter((h) => prefs.cvKeywords.includes(h) || prefs.extraKeywords.includes(h));
  score += Math.min(25, hits.length * 3);
  if (cvHits.length) reasons.push({ text: `Pasuje do CV: ${cvHits.slice(0, 4).join(", ")}`, tone: "good" });
  else if (hits.length >= 3) reasons.push({ text: `Tematy: ${hits.slice(0, 3).join(", ")}`, tone: "good" });

  const excluded = prefs.excludeKeywords.find((w) => w.trim() && has(title.toLowerCase(), w));
  if (excluded) {
    score -= 40;
    reasons.push({ text: `Wykluczone słowo: ${excluded}`, tone: "bad" });
  }

  // Languages.
  const required = requiredLanguages(job.description).filter((l) => !prefs.languages.includes(l));
  if (required.length) {
    score -= 30;
    reasons.push({ text: `Wymaga: ${required.map((l) => LANGUAGE_LABEL[l] ?? l).join(", ")}`, tone: "bad" });
  }
  const written = adLanguage(`${job.title} ${job.description}`);
  if (written !== "unknown" && !prefs.languages.includes(written) && !required.includes(written)) {
    score -= 25;
    reasons.push({ text: `Ogłoszenie ${WRITTEN_IN[written] ?? `w języku: ${written}`}`, tone: "bad" });
  }

  // Seniority and work type.
  if (JUNIOR.test(title)) {
    score -= 20;
    reasons.push({ text: "Stanowisko juniorskie lub staż", tone: "warn" });
  }
  const type = `${job.employmentType ?? ""} ${title}`.toLowerCase();
  if (/part[- ]?time|teilzeit|część etatu|niepełn/.test(type) && !prefs.workTypes.includes("part_time")) {
    score -= 15;
    reasons.push({ text: "Część etatu", tone: "warn" });
  }
  if (/freelanc|contract|b2b|kontrakt|zlecen/.test(type)) {
    if (prefs.workTypes.includes("freelance")) reasons.push({ text: "Kontrakt / B2B", tone: "good" });
    else score -= 15;
  }

  if (job.favourite) {
    score += 10;
    reasons.push({ text: `Ulubiona firma: ${job.companyName}`, tone: "good" });
  }
  if (job.postedAt && now.getTime() - job.postedAt.getTime() < 3 * 86_400_000) score += 3;

  // A title that is not one of the owner's roles never ranks, however many topic words the ad has.
  if (!titleHit) {
    score = Math.min(score, NO_ROLE_CAP);
    reasons.push({ text: "Tytuł nie wskazuje roli L&D", tone: "bad" });
  }

  return {
    score: eligible ? clamp(score) : 0,
    eligible,
    region,
    reasons,
    requiredLanguages: requiredLanguages(job.description),
    hits,
    role: titleHit,
  };
}

/** "Watford, …, UK; Mollsfeld, Meerbusch, Germany; Brussels, …" → "Germany, Belgium +2". */
function shortPlace(location: string | null | undefined): string | null {
  if (!location) return null;
  const parts = location.split(/;\s*/).filter(Boolean);
  if (parts.length < 2) return location;
  const eu = parts.filter((p) => countryOf(p)).map((p) => p.split(",").pop()?.trim() ?? p);
  const uniq = [...new Set(eu.length ? eu : parts.map((p) => p.split(",").pop()?.trim() ?? p))];
  return uniq.length > 2 ? `${uniq.slice(0, 2).join(", ")} +${uniq.length - 2}` : uniq.join(", ");
}

/**
 * Kept in the database: eligible, and the title is one of the owner's roles with a good enough score.
 * Favourite companies keep every offer in a reachable place (shown under "Ulubione" only, since an
 * offer outside the owner's roles is capped below the lists' thresholds).
 */
export function worthKeeping(m: MatchResult, favourite: boolean, minKeep = 25): boolean {
  if (!m.eligible) return false;
  if (favourite) return true;
  return m.role !== null && m.score >= minKeep;
}

/** A quick, cheap check before fetching a full description (titles only). */
export function titleLooksRelevant(title: string, prefs: CareerPrefs, mediaCompany = false): boolean {
  if (OFF_TARGET.test(title)) return false;
  return familyOfTitle(title, prefs.roleFamilies, mediaCompany) !== null;
}
