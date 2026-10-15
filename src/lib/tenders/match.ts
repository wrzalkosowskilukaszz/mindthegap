/**
 * How well a request for quotes (zapytanie ofertowe) fits the owner: soft-skills, leadership, coaching and
 * facilitation work for adults, ideally in Warsaw, anywhere in Poland or online. Free and explainable: the
 * score is a sum of visible word rules, never AI. Vocational courses, language courses and school classes
 * are pushed down, not hidden.
 */

export type TenderInput = {
  title: string;
  text: string;
  place: string | null;
  conditions?: string[];
};
export type TenderReason = { text: string; tone: "good" | "warn" | "bad" };
export type TenderMatch = { score: number; reasons: TenderReason[]; topics: string[] };

type Rule = { label: string; re: RegExp; points: number; titleOnly?: boolean };

const w = (alts: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts})`, "iu");

/** Topics the owner delivers. Each counts once. */
const GOOD: Rule[] = [
  { label: "coaching", re: w("coach\\p{L}*|coaching\\p{L}*"), points: 22 },
  { label: "mentoring", re: w("mentor\\p{L}*"), points: 18 },
  { label: "tutoring", re: w("tutor\\p{L}*"), points: 14 },
  { label: "facylitacja", re: w("facylit\\p{L}*|facilitat\\p{L}*|moderowani\\p{L}*"), points: 18 },
  {
    label: "przywództwo / menedżerowie",
    re: w(
      "przyw[óo]dc\\p{L}*|przyw[óo]dztw\\p{L}*|lider\\p{L}*|leadership|mened[żz]er\\p{L}*|menad[żz]er\\p{L}*|kadr\\p{L}* (zarz[ąa]dzaj\\p{L}*|kierownicz\\p{L}*)|zarz[ąa]dzani\\p{L}* zesp[oó]\\p{L}*",
    ),
    points: 22,
  },
  {
    label: "kompetencje miękkie",
    re: w(
      "kompetencj\\p{L}* (mi[ęe]kk\\p{L}*|spo[łl]eczn\\p{L}*|interpersonaln\\p{L}*|osobist\\p{L}*)|soft skills|TKS(?!\\p{L})",
    ),
    points: 20,
  },
  { label: "komunikacja", re: w("komunikac\\p{L}*|communication"), points: 12 },
  { label: "warsztaty", re: w("warsztat\\p{L}*|workshop\\p{L}*"), points: 10 },
  {
    label: "team building",
    re: w("team[- ]?building\\p{L}*|integracj\\p{L}* zesp\\p{L}*|budowani\\p{L}* zesp\\p{L}*"),
    points: 16,
  },
  { label: "trenerzy", re: w("trener\\p{L}*|trainer\\p{L}*|wyk[łl]adowc\\p{L}*"), points: 10 },
  {
    label: "stres / dobrostan",
    re: w(
      "stres\\p{L}*|wypaleni\\p{L}*|dobrostan\\p{L}*|well-?being|work[- ]life|odporno[śs]\\p{L}* psychiczn\\p{L}*|rezyliencj\\p{L}*",
    ),
    points: 12,
  },
  { label: "asertywność", re: w("asertywn\\p{L}*"), points: 10 },
  { label: "negocjacje", re: w("negocjac\\p{L}*"), points: 10 },
  {
    label: "wystąpienia publiczne",
    re: w("wyst[ąa]pie\\p{L}* publiczn\\p{L}*|autoprezentac\\p{L}*|prezentac\\p{L}*"),
    points: 10,
  },
  { label: "motywacja", re: w("motywac\\p{L}*"), points: 8 },
  { label: "zarządzanie czasem", re: w("zarz[ąa]dzani\\p{L}* czasem|time management"), points: 8 },
  { label: "zarządzanie zmianą", re: w("zarz[ąa]dzani\\p{L}* zmian\\p{L}*|change management"), points: 12 },
  {
    label: "kreatywność",
    re: w("kreatywn\\p{L}*|design thinking|innowacyjn\\p{L}* my[śs]lenie"),
    points: 10,
  },
  { label: "feedback", re: w("feedback\\p{L}*|informacj\\p{L}* zwrotn\\p{L}*"), points: 8 },
  {
    label: "inteligencja emocjonalna",
    re: w("inteligencj\\p{L}* emocjonaln\\p{L}*|emocj\\p{L}*"),
    points: 8,
  },
  {
    label: "różnorodność / równość",
    re: w(
      "r[óo][żz]norodno[śs]\\p{L}*|r[óo]wno[śs]\\p{L}* szans|antydyskrymin\\p{L}*|mobbing\\p{L}*|diversity",
    ),
    points: 8,
  },
  { label: "obsługa klienta", re: w("obs[łl]ug\\p{L}* klient\\p{L}*|customer service"), points: 6 },
  {
    label: "rozwój osobisty",
    re: w("rozw[óo]j\\p{L}* osobist\\p{L}*|rozwoj\\p{L}* osobist\\p{L}*"),
    points: 8,
  },
];

/** Work the owner does not do. Strong pull-down, still shown under "Wszystkie". */
const OFF: Rule[] = [
  {
    label: "kurs zawodowy",
    re: w(
      "w[óo]zk\\p{L}* (wid[łl]ow\\p{L}*|jezdniow\\p{L}*)|spawa\\p{L}*|operator\\p{L}* (w[óo]zk|koparki|maszyn|d[źz]wig|suwnic|[łl]adowark|CNC)\\p{L}*|trener\\p{L}* personaln\\p{L}*|prawo jazdy|prawa jazdy|kierowc\\p{L}*|koparko\\p{L}*|SEP(?!\\p{L})|uprawnie\\p{L}* (energetyczn\\p{L}*|elektryczn\\p{L}*)|fryzjer\\p{L}*|kosmetycz\\p{L}*|kosmetolog\\p{L}*|barist\\p{L}*|kucharz\\p{L}*|kucharsk\\p{L}*|gastronom\\p{L}*|magazynier\\p{L}*|flory[sś]\\p{L}*|kelner\\p{L}*|barman\\p{L}*|sprzedawc\\p{L}*|krawiec\\p{L}*|krawieck\\p{L}*|stylizac\\p{L}* paznokci|manicure|masa[żz]\\p{L}*|opiekun\\p{L}* (os[óo]b|medyczn|dzieci|senior)\\p{L}*|instruktor\\p{L}* (rekreac|fitness|nauki jazdy)\\p{L}*|szkoleni\\p{L}* zawodow\\p{L}*|kurs\\p{L}* zawodow\\p{L}*|pracownik gospodarczy|monter\\p{L}*|elektryk\\p{L}*|hydraulik\\p{L}*|budowlan\\p{L}*",
    ),
    points: -45,
  },
  {
    label: "kadry, księgowość, BHP",
    re: w(
      "kadr\\p{L}* i p[łl]ac\\p{L}*|ksi[ęe]gow\\p{L}*|p[łl]ac\\p{L}* i kadr\\p{L}*|BHP(?!\\p{L})|pierwsz\\p{L}* pomoc\\p{L}*|ppo[żz]\\p{L}*",
    ),
    points: -40,
  },
  {
    label: "kurs językowy",
    re: w(
      "j[ęe]zyk\\p{L}* (angielsk|niemieck|polsk|hiszpa[ńn]sk|francusk|w[łl]osk|rosyjsk|ukrai[ńn]sk|migowy)\\p{L}*|j\\. ?(angielsk|niemieck|polsk|hiszpa[ńn]sk)\\p{L}*|lektor\\p{L}*",
    ),
    points: -40,
  },
  {
    label: "dzieci, rodzina, szkoła",
    re: w(
      "dzieci|dziecka|przedszkol\\p{L}*|uczni\\p{L}*|uczennic\\p{L}*|szk[oó][łl]\\p{L}* podstawow\\p{L}*|roku szkoln\\p{L}*|szkoln\\p{L}* (zaj[ęe]|warszt)\\p{L}*|liceum|technikum|korepetycj\\p{L}*|robotyk\\p{L}*|placówk\\p{L}* wsparcia dziennego|świetlic\\p{L}*|dla rodzin\\p{L}*|wsparci\\p{L}* rodzin\\p{L}*|rodzicielsk\\p{L}*|rodzic[óo]w|senior\\p{L}*",
    ),
    points: -50,
  },
  {
    label: "IT / cyfrowe",
    re: w(
      "programowani\\p{L}*|cyberbezpiecze\\p{L}*|ECDL(?!\\p{L})|ICDL(?!\\p{L})|kompetencj\\p{L}* cyfrow\\p{L}*|excel\\p{L}*|grafik\\p{L}* komputerow\\p{L}*|SZBI(?!\\p{L})|audyt\\p{L}*",
    ),
    points: -30,
  },
  {
    label: "terapia / zdrowie",
    re: w(
      "terapi\\p{L}*|terapeut\\p{L}*|logoped\\p{L}*|fizjoterap\\p{L}*|rehabilitac\\p{L}*|medyczn\\p{L}*|prozdrowotn\\p{L}*|lekarsk\\p{L}*|psycholog\\p{L}*|psychiatr\\p{L}*",
    ),
    points: -30,
  },
  {
    label: "hotel, catering, promocja",
    re: w(
      "hotel\\p{L}*|nocleg\\p{L}*|catering\\p{L}*|wy[żz]ywieni\\p{L}*|promocj\\p{L}*|druk\\p{L}*|gad[żz]et\\p{L}*",
    ),
    points: -45,
    titleOnly: true,
  },
];

/** A long description mentions many things; what it adds on top of the title is capped. */
const TEXT_TOPICS_CAP = 30;

const WARSAW = w("warszaw\\p{L}*|mazowieck\\p{L}*");
const ANYWHERE = w("ca[łl]a polska|ca[łl]ej polsce|online|zdaln\\p{L}*|on-line|wiele miejsc");
const ADULTS_AT_WORK = w(
  "pracownik\\p{L}*|przedsi[ęe]biorstw\\p{L}*|przedsi[ęe]biorc\\p{L}*|firm\\p{L}*|MŚP(?!\\p{L})|MSP(?!\\p{L})|kadr\\p{L}*|organizacj\\p{L}* pozarz\\p{L}*|NGO(?!\\p{L})",
);
const RIS = w("rejestr\\p{L}* instytucji szkoleniowych|RIS(?!\\p{L})");

export function scoreTender(t: TenderInput): TenderMatch {
  const hay = `${t.title}\n${t.text}`;
  const reasons: TenderReason[] = [];
  const topics: string[] = [];
  let score = 25;
  let fromText = 0;
  const titleTopics: string[] = [];
  for (const r of GOOD) {
    // The title says what is being bought: it counts fully; the description adds a capped amount.
    if (r.re.test(t.title)) {
      score += r.points * 1.5;
      titleTopics.push(r.label);
    } else if (r.re.test(t.text)) {
      fromText += r.points * 0.6;
      topics.push(r.label);
    }
  }
  score += Math.min(TEXT_TOPICS_CAP, fromText);
  topics.unshift(...titleTopics);
  if (topics.length) reasons.push({ text: topics.slice(0, 3).join(", "), tone: "good" });
  const off = OFF.filter((r) => r.re.test(r.titleOnly ? t.title : hay));
  // Off-topic words in the title weigh fully; in the text (e.g. "parents of young children") only half.
  for (const r of off) score += r.re.test(t.title) ? r.points : r.points / 2;
  if (off.length) reasons.push({ text: off.map((r) => r.label).join(", "), tone: "bad" });

  if (ADULTS_AT_WORK.test(hay)) score += 6;
  const place = t.place ?? "";
  if (WARSAW.test(place) || WARSAW.test(t.title)) {
    score += 12;
    reasons.push({ text: "Warszawa / mazowieckie", tone: "good" });
  } else if (ANYWHERE.test(place) || ANYWHERE.test(t.text)) {
    score += 10;
    reasons.push({ text: ANYWHERE.test(place) ? place : "Możliwe online", tone: "good" });
  } else if (place) reasons.push({ text: place, tone: "warn" });

  if (t.conditions?.some((c) => RIS.test(c)) || RIS.test(t.text))
    reasons.push({ text: "Wymaga wpisu do RIS", tone: "warn" });

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons, topics };
}

/** Days left to the deadline, rounded down; negative when it has passed. */
export function daysLeft(deadline: Date, now = new Date()): number {
  return Math.floor((deadline.getTime() - now.getTime()) / 86_400_000);
}
