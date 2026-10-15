/**
 * Role taxonomy for training/development buyers (PL + EN titles).
 *
 * The result is an evidence-based assessment of a published title, NOT confirmed purchasing
 * authority. Recruiting / talent-acquisition roles are explicitly not treated as buyers of
 * employee development.
 */
import { foldDiacritics } from "./normalize.ts";

export type RoleCategory = "decision_maker" | "organizer_influencer" | "departmental_inbox" | "general_routing" | "uncertain";

export type RoleAssessment = {
  category: RoleCategory;
  relevant: boolean;
  label: string; // short human label of the matched rule
  excluded?: string; // why a title is not a development buyer
};

type Rule = { re: RegExp; category: RoleCategory; label: string };

// Matching runs on diacritic-folded, lower-cased text.
const EXCLUDE: { re: RegExp; label: string }[] = [
  { re: /\b(talent acquisition|recruit\w*|rekrut\w*|sourc(er|ing)|headhunt\w*)\b/, label: "Rekrutacja / Talent Acquisition" },
  { re: /\b(employer branding)\b/, label: "Employer branding" },
  { re: /\b(payroll|plac\w*|kadr\w* i plac\w*|compensation|benefit\w*|c&b|reward)\b/, label: "Płace / wynagrodzenia" },
  {
    re: /\b(badan\w* i rozwoj\w*|research (and|&) development|r ?& ?d|rozwoj\w* (produkt\w*|biznes\w*|sprzedaz\w*|technolog\w*|oprogramowani\w*|rynk\w*)|(product|business|software|technical|market) development|developer)\b/,
    label: "R&D / rozwój biznesu (nie rozwój ludzi)",
  },
];

/** Development of people, not of products or markets. */
const PEOPLE_DEV = "rozwoj\\w* (pracownik\\w*|organizacj\\w*|talent\\w*|kompetencj\\w*|przywodztw\\w*|kadr\\w*|ludzi|liderow|menedzer\\w*|osobist\\w*|zespol\\w*)";

const RULES: Rule[] = [
  // Likely decision-makers: lead the development / people function.
  { re: /\b(chief (people|human resources?|hr|talent|learning) officer|chro|cpo)\b/, category: "decision_maker", label: "Szef funkcji HR/People" },
  { re: /\b(vp|vice president|svp|evp)\b.*\b(hr|human resources|people|talent|learning|culture)\b/, category: "decision_maker", label: "VP HR/People/Learning" },
  { re: new RegExp(`\\b(head|director|dyrektor\\w*|lead)\\b.*\\b(learning|l&d|l ?& ?d|training|szkolen\\w*|leadership development|talent (development|management)|people development|organi[sz]ational development|${PEOPLE_DEV}|akademi\\w*|academy)`), category: "decision_maker", label: "Kierownictwo L&D / rozwoju" },
  { re: /\b(head|director|dyrektor\w*)\b.*\b(hr|human resources|people|personal\w*|kadr\w*|zasobow ludzkich|zarzadzania zasobami ludzkimi|people & culture|people and culture|culture|kapitalu ludzkiego)\b/, category: "decision_maker", label: "Dyrektor HR / People" },
  { re: /\b(dyrektor personalny|dyrektorka personalna|dyrektor ds\.? personalnych|dyrektor ds\.? hr)\b/, category: "decision_maker", label: "Dyrektor personalny" },
  { re: /\b(czlon\w* zarzadu|wiceprezes\w*|vice-?president)\b.*\b(hr|personal\w*|ludzi|kadr\w*|zasob\w* ludzk\w*|people)\b/, category: "decision_maker", label: "Zarząd ds. HR" },
  { re: /\b(hr director|people director|people & culture director|director of people|director of hr|hr lead|head of people|head of hr)\b/, category: "decision_maker", label: "HR / People Director" },

  // Organisers / influencers: run or shape programmes.
  { re: /\b(learning (and|&) development|l&d|l ?& ?d)\b/, category: "organizer_influencer", label: "L&D" },
  { re: new RegExp(`\\b(leadership development|talent development|people development|organi[sz]ational development|learning|training|trainer|szkolen\\w*|trener\\w*|${PEOPLE_DEV}|akademi\\w*|academy|onboarding)`), category: "organizer_influencer", label: "Szkolenia i rozwój" },
  { re: /\b(hr business partner|hrbp|business partner hr|partner biznesowy hr)\b/, category: "organizer_influencer", label: "HR Business Partner" },
  { re: /\b(talent management|talent manager|engagement|culture (manager|lead)|change management)\b/, category: "organizer_influencer", label: "Talent / kultura / zmiana" },
  { re: /\b(hr manager|people manager|kierownik\w* (dzialu )?(hr|kadr\w*|personaln\w*)|menedzer\w* (hr|ds\.? personalnych)|hr generalist|specjalist\w* ds\.? (hr|personalnych|rozwoju))\b/, category: "organizer_influencer", label: "HR (kierownik / specjalista)" },
];

export function assessRole(title: string | null | undefined): RoleAssessment {
  if (!title || !title.trim()) return { category: "uncertain", relevant: false, label: "Brak stanowiska" };
  const t = foldDiacritics(title).replace(/\s+/g, " ");
  for (const ex of EXCLUDE) {
    if (ex.re.test(t)) {
      // "Head of Talent Acquisition & Development" still mentions development: keep as uncertain, not excluded.
      const alsoDev = new RegExp(`\\b(learning|l&d|szkolen\\w*|training|akademi\\w*|academy|people development|talent development|leadership development|${PEOPLE_DEV})`).test(t);
      if (!alsoDev) return { category: "uncertain", relevant: false, label: ex.label, excluded: ex.label };
    }
  }
  for (const r of RULES) {
    if (r.re.test(t)) return { category: r.category, relevant: true, label: r.label };
  }
  return { category: "uncertain", relevant: false, label: "Rola niepewna" };
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
  "szkoleń",
  "szkolen",
  "rozwoj",
  "rozwoju",
  "akademia",
  "personalny",
  "personalna",
  "kadr",
  "zasobów ludzkich",
];
