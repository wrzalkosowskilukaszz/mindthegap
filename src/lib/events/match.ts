/**
 * How useful an event is for meeting people who buy or run training: L&D, HR and people leaders,
 * training managers, coaches. Word rules with visible reasons, never AI. Place: Warsaw and online first.
 */

export type EventInput = {
  title: string;
  text: string;
  organiser: string | null;
  place: string | null;
  online: boolean;
};
export type EventReason = { text: string; tone: "good" | "warn" | "bad" };
export type EventMatch = { score: number; reasons: EventReason[]; topics: string[] };

type Rule = { label: string; re: RegExp; points: number };
const w = (alts: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts})`, "iu");

const AUDIENCE: Rule[] = [
  {
    label: "L&D / szkolenia",
    re: w(
      "L&D(?!\\p{L})|learning (and|&) development|learning|szkole\\p{L}*|trener\\p{L}*|trainer\\p{L}*|training manager\\p{L}*|rozw[óo]j\\p{L}* pracownik\\p{L}*|rozwoju pracownik\\p{L}*|edukacj\\p{L}* korporacyjn\\p{L}*|akademi\\p{L}* (wewn|korpor)\\p{L}*|e-?learning\\p{L}*|instructional design",
    ),
    points: 24,
  },
  {
    label: "HR / people",
    re: w(
      "HR(?!\\p{L})|HRBP|human resources|zasob\\p{L}* ludzk\\p{L}*|people (and|&) culture|people team|people leader\\p{L}*|kadr\\p{L}* zarz|personel\\p{L}*|employer branding|employee experience|zaanga[żz]owani\\p{L}* pracownik\\p{L}*|kultur\\p{L}* organizac\\p{L}*",
    ),
    points: 22,
  },
  {
    label: "przywództwo",
    re: w(
      "przyw[óo]dztw\\p{L}*|leadership|lider\\p{L}*|mened[żz]er\\p{L}*|menad[żz]er\\p{L}*|kadr\\p{L}* kierownicz\\p{L}*",
    ),
    points: 14,
  },
  {
    label: "coaching / mentoring",
    re: w("coach\\p{L}*|mentor\\p{L}*|ICF(?!\\p{L})|EMCC(?!\\p{L})"),
    points: 16,
  },
  {
    label: "facylitacja / warsztaty",
    re: w("facylit\\p{L}*|facilitat\\p{L}*|warsztat\\p{L}*|workshop\\p{L}*"),
    points: 10,
  },
  {
    label: "rozwój organizacji",
    re: w(
      "rozw[óo]j\\p{L}* organizac\\p{L}*|organi[sz]ational development|zarz[ąa]dzani\\p{L}* zmian\\p{L}*|change management|transformac\\p{L}*",
    ),
    points: 10,
  },
  {
    label: "dobrostan / DEI",
    re: w(
      "well-?being|dobrostan\\p{L}*|DEI(?!\\p{L})|r[óo][żz]norodno[śs]\\p{L}*|inkluzywn\\p{L}*|diversity|inclusion",
    ),
    points: 8,
  },
];

const FORMAT: Rule[] = [
  {
    label: "konferencja",
    re: w("konferencj\\p{L}*|kongres\\p{L}*|conference|summit|forum|festiwal\\p{L}*|gala"),
    points: 8,
  },
  {
    label: "networking",
    re: w("networking\\p{L}*|meetup\\p{L}*|spotkani\\p{L}*|śniadani\\p{L}* biznesow\\p{L}*|breakfast|mixer"),
    points: 10,
  },
  { label: "webinar", re: w("webinar\\p{L}*|webinari\\p{L}*|online"), points: 2 },
];

/** Events for other crowds: developers, sales-only, consumer and student fairs. */
const OFF: Rule[] = [
  {
    label: "dla programistów",
    re: w(
      "machine learning|deep learning|data science|javascript|java(?!\\p{L})|python|react(?!\\p{L})|devops|kubernetes|frontend|backend|hackathon\\p{L}*|programist\\p{L}*|developer\\p{L}*|\\.net(?!\\p{L})",
    ),
    points: -35,
  },
  {
    label: "kadry i płace",
    re: w(
      "kadr\\p{L}* i p[łl]ac\\p{L}*|kadry, p[łl]ac\\p{L}*|kadrowo-p[łl]acow\\p{L}*|p[łl]ac\\p{L}* i kadr\\p{L}*|prawo pracy|prawa pracy|ZUS(?!\\p{L})",
    ),
    points: -25,
  },
  {
    label: "targi pracy / dla studentów",
    re: w("targi pracy|job fair|career fair|dla student\\p{L}*|dzie[ńn] otwarty|rekrutac\\p{L}* na studia"),
    points: -30,
  },
  {
    label: "inny temat",
    re: w(
      "kryptowalut\\p{L}*|crypto|nieruchomo[śs]\\p{L}*|real estate|trading|forex|fitness|joga|yoga|koncert\\p{L}*|wine|wino",
    ),
    points: -30,
  },
];

const WARSAW = w("warszaw\\p{L}*|warsaw");

export function scoreEvent(e: EventInput): EventMatch {
  const hay = `${e.title}\n${e.organiser ?? ""}\n${e.text}`;
  const reasons: EventReason[] = [];
  const topics: string[] = [];
  let score = 20;
  let fromText = 0;
  for (const r of AUDIENCE) {
    if (r.re.test(e.title)) {
      score += r.points * 1.4;
      topics.push(r.label);
    } else if (r.re.test(hay)) {
      fromText += r.points * 0.6;
      topics.push(r.label);
    }
  }
  score += Math.min(28, fromText);
  if (topics.length) reasons.push({ text: topics.slice(0, 3).join(", "), tone: "good" });
  const formats = FORMAT.filter((r) => r.re.test(`${e.title}\n${e.text}`));
  for (const r of formats) score += r.points;
  const off = OFF.filter((r) => r.re.test(hay));
  for (const r of off) score += r.re.test(e.title) ? r.points : r.points / 2;
  if (off.length) reasons.push({ text: off.map((r) => r.label).join(", "), tone: "bad" });

  const place = e.place ?? "";
  if (WARSAW.test(place) || WARSAW.test(e.title)) {
    score += 14;
    reasons.push({ text: "Warszawa", tone: "good" });
  } else if (e.online) {
    score += 8;
    reasons.push({ text: "Online", tone: "good" });
  } else if (place) reasons.push({ text: place, tone: "warn" });
  if (formats.some((f) => f.label === "networking")) reasons.push({ text: "networking", tone: "good" });

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons, topics };
}
