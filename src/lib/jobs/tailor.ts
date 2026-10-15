/**
 * Tailoring the CV to one job offer, without AI: which skill words of the offer the CV already shows and
 * which it does not, and splitting a pasted AI answer into the CV and its "to check" notes. A word counts
 * only when it is literally in the text (or its Polish/English twin); nothing is inferred.
 */
import { adLanguage, LANG_NAMES, LANGUAGE_LABEL, requiredLanguages } from "./match.ts";

type Skill = { label: string; ci: RegExp | null; cs: RegExp | null };

/**
 * `*` at the end of a word allows any ending ("facilitat*" → facilitation, facilitator). Alternatives in
 * capitals ("LMS", "AI") or marked with a leading `=` ("=Workday") are matched case-sensitively, so
 * "aid", "excel at" or "during the workday" do not count.
 */
function skill(label: string, ...alts: string[]): Skill {
  const word = (w: string) =>
    w.replace(/\*$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (w.endsWith("*") ? "[\\p{L}\\p{N}]*" : "");
  const part = (a: string) => a.replace(/^=/, "").split(" ").map(word).join("[\\s-]+");
  const build = (xs: string[], flags: string) =>
    xs.length
      ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${xs.map(part).join("|")})(?![\\p{L}\\p{N}])`, flags)
      : null;
  const exact = alts.filter((a) => a.startsWith("=") || (/^[A-Z0-9&/-]+$/.test(a) && /[A-Z]/.test(a)));
  return {
    label,
    ci: build(
      alts.filter((a) => !exact.includes(a)),
      "iu",
    ),
    cs: build(exact, "u"),
  };
}

const SKILLS: Skill[] = [
  // Learning & development
  skill("learning & development", "learning & development", "learning and development", "L&D"),
  skill("szkolenia (training)", "training*", "trainer*", "szkoleni*", "szkoleń", "trener*"),
  skill("facylitacja", "facilitat*", "facylitac*", "facylitator*", "moderowani*"),
  skill("warsztaty", "workshop*", "warsztat*"),
  skill(
    "leadership development",
    "leadership development",
    "leadership program*",
    "rozwój przywództwa",
    "rozwoju przywództwa",
    "rozwój liderów",
    "rozwoju liderów",
    "programy przywódcze",
  ),
  skill("instructional design", "instructional design*", "learning design*", "learning experience design*"),
  skill("e-learning", "e-learning*", "elearning*"),
  skill("blended learning", "blended learning", "blended"),
  skill("microlearning", "microlearning", "micro-learning", "mikrolearning"),
  skill("LMS / LXP", "LMS", "LXP", "learning management system*", "platform* szkoleniow*"),
  skill("onboarding", "onboarding*", "wdrożeni* pracownik*", "wdrożeni* now* pracownik*"),
  skill(
    "analiza potrzeb szkoleniowych",
    "training needs",
    "needs analysis",
    "needs assessment",
    "TNA",
    "analiz* potrzeb*",
  ),
  skill("ewaluacja szkoleń", "kirkpatrick", "training evaluation", "learning evaluation", "ewaluacj*"),
  skill("ADDIE", "ADDIE"),
  skill("Articulate / Storyline / Rise", "articulate 360", "articulate storyline", "=Storyline", "rise 360"),
  skill("Adobe Captivate", "adobe captivate", "=Captivate"),
  skill("Camtasia", "camtasia"),
  skill("Canva", "canva"),
  skill("Miro / Mural", "miro", "mural"),
  skill("SCORM / xAPI", "SCORM", "xAPI"),
  skill("Docebo", "docebo"),
  skill("Cornerstone", "cornerstone ondemand", "=Cornerstone"),
  skill("Workday", "=Workday"),
  skill("SuccessFactors", "successfactors"),
  skill("Degreed", "=Degreed"),
  skill("LinkedIn Learning", "linkedin learning"),
  skill("Coursera", "coursera"),
  // People & organisation
  skill(
    "rozwój organizacji (OD)",
    "organizational development",
    "organisational development",
    "organization development",
    "organisation development",
    "rozwój organizacji",
    "rozwoju organizacji",
  ),
  skill("change management", "change management", "zarządzani* zmian*", "prosci", "ADKAR"),
  skill("talent management", "talent management", "talent review*", "zarządzani* talent*"),
  skill("performance management", "performance management", "performance review*", "ocen* okresow*"),
  skill("zaangażowanie pracowników", "employee engagement", "engagement survey*", "zaangażowani* pracownik*"),
  skill("employee experience", "employee experience"),
  skill("sukcesja", "succession*", "sukcesj*"),
  skill("modele kompetencji", "competenc* model*", "competenc* framework*", "model* kompetencj*"),
  skill("assessment / development center", "assessment cent*", "development cent*", "AC/DC"),
  skill("feedback 360", "360 feedback", "360-degree*", "360°", "ocen* 360", "feedback 360"),
  skill("DEI", "DEI", "D&I", "DE&I", "inclusion program*", "inclusion initiative*", "inclusion strateg*"),
  skill("HR business partnering", "hr business partner*", "HRBP"),
  skill("employer branding", "employer branding", "employer brand"),
  skill("people analytics", "people analytics", "hr analytics", "analityk* hr", "analityk* personaln*"),
  // Coaching & consulting
  skill("coaching", "coach*"),
  skill("certyfikat ICF / EMCC", "ICF", "EMCC", "ACC", "PCC", "MCC"),
  skill("mentoring", "mentor*"),
  skill("team coaching / efektywność zespołów", "team coaching", "team effectiveness", "team dynamics"),
  skill(
    "narzędzia psychometryczne",
    "psychometri*",
    "psychometr*",
    "MBTI",
    "hogan",
    "DISC",
    "gallup",
    "cliftonstrengths",
    "strengthsfinder",
    "insights discovery",
  ),
  skill("design thinking", "design thinking"),
  skill("praca z interesariuszami", "stakeholder*", "interesariusz*"),
  skill("doradztwo / consulting", "consulting", "consultant*", "doradztw*", "konsulting*"),
  skill("zarządzanie projektami", "project management", "zarządzani* projekt*", "PMP", "prince2"),
  skill("zarządzanie programami", "program management", "programme management"),
  skill("agile / scrum", "agile", "scrum", "zwinn*"),
  skill("OKR", "OKR", "OKRs"),
  skill(
    "współpraca z dostawcami",
    "vendor management",
    "external vendors",
    "external providers",
    "zarządzani* dostawc*",
  ),
  skill(
    "zarządzanie budżetem",
    "budget management",
    "budget ownership",
    "manag* budget*",
    "own* budget*",
    "zarządzani* budżet*",
    "budżetowani*",
  ),
  skill("wystąpienia publiczne", "public speaking", "presentation skills", "wystąpie* publiczn*"),
  // Creative & media
  skill("tworzenie treści", "content creation", "content creator*", "tworzeni* treści", "content strateg*"),
  skill("storytelling", "storytelling"),
  skill("wideo", "video*", "wideo"),
  skill("community management", "community management", "community manager*", "społecznoś*"),
  skill("social media", "social media", "media społecznościow*"),
  skill("współpraca z twórcami", "creator*", "influencer*", "twórcami", "twórców", "twórcy"),
  skill("trust & safety", "trust & safety", "trust and safety"),
  skill("copywriting", "copywrit*"),
  skill("narzędzia AI", "AI", "GenAI", "generative ai", "chatgpt", "sztuczn* inteligencj*", "LLM", "LLMs"),
];

const found = (s: Skill, text: string, raw: string) => Boolean(s.ci?.test(text) || s.cs?.test(raw));

export type CvGap = { inCv: string[]; missing: string[] };

/** Skill words and required languages of an offer, split into what the CV shows and what it does not. */
export function cvGap(offer: { title: string; description: string }, cvText: string): CvGap {
  const offerRaw = `${offer.title}\n${offer.description}`;
  const offerText = offerRaw.toLowerCase();
  const cvLower = cvText.toLowerCase();
  const cvLanguage = adLanguage(cvText);
  const inCv: string[] = [];
  const missing: string[] = [];
  for (const s of SKILLS) {
    if (!found(s, offerText, offerRaw)) continue;
    (found(s, cvLower, cvText) ? inCv : missing).push(s.label);
  }
  for (const code of requiredLanguages(offer.description)) {
    const label = `język ${LANGUAGE_LABEL[code] ?? code}`;
    // A CV written in the language counts too, even without a "Languages" line.
    (LANG_NAMES[code]?.test(cvText) || cvLanguage === code ? inCv : missing).push(label);
  }
  return { inCv, missing };
}

const CHECKS_HEADING = /^\s*(?:#{1,6}\s*|\*\*\s*)?do sprawdzenia\b[^\n]*$/im;

/**
 * A pasted AI answer is the CV, then (as the prompt asks) a "Do sprawdzenia" section with the offer's
 * requirements the CV does not show. The section never goes into the Word file.
 */
export function splitTailored(text: string): { cv: string; checks: string[] } {
  const t = text.replace(/\r\n?/g, "\n");
  const m = CHECKS_HEADING.exec(t);
  if (!m) return { cv: t.trim(), checks: [] };
  const cv = t
    .slice(0, m.index)
    .replace(/\n\s*(-{3,}|\*{3,}|_{3,})\s*$/, "")
    .trim();
  const checks = t
    .slice(m.index + m[0].length)
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
        .replace(/\*\*/g, "")
        .trim(),
    )
    .filter((l) => l && !/^(-{3,}|\*{3,}|_{3,})$/.test(l))
    .slice(0, 30);
  return { cv, checks };
}
