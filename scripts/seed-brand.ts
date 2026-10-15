/**
 * Seeds DRAFT programmes and UNAPPROVED profile facts from the owner's public website
 * (https://leadersmindthegap.com/, read 2026-10-15) and from the owner's brief.
 * Nothing here is used in emails until the owner approves it in Materiały.
 * Idempotent: existing programmes with the same name and already-saved profile settings are kept.
 *   node --env-file=.env.local --import tsx scripts/seed-brand.ts
 */
import { eq } from "drizzle-orm";
import { closeDb, db } from "../src/server/db/client.ts";
import { programs, settings } from "../src/server/db/schema.ts";
import { getSettings, saveSettings } from "../src/server/settings.ts";

const SITE = "https://leadersmindthegap.com/";
const READ = "2026-10-15";
const q = (value: string, quote = value) => ({ value, quote, quoteVerified: true });

const PROGRAMS = [
  {
    name: "Team Reset",
    summary: {
      audience: q("One intact team: leader + their people", "One intact team: leader + their people"),
      problem: q(
        "A reset of how your team communicates and collaborates – built around how you work now, not how you used to.",
      ),
      keyPoints: [q("Starts with an honest diagnosis"), q("One deep session or a short series")],
      outcomes: [q("You leave with a charter + 30-day plan")],
      format: q("In-person or online · half-day to multi-day"),
      language: q("English, Polish, and German", "We work in English, Polish, and German, across Europe."),
    },
  },
  {
    name: "Leading Through the AI Shift",
    summary: {
      audience: q(
        "People managers",
        "A practical program for people managers, helping them gain more confidence and tools on leading teams through ambiguous times.",
      ),
      problem: q(
        "Helping people managers gain more confidence and tools on leading teams through ambiguous times.",
        "A practical program for people managers, helping them gain more confidence and tools on leading teams through ambiguous times.",
      ),
      keyPoints: [
        q("Leading through ambiguity, without fake certainty"),
        q("Handling AI anxiety, protecting trust"),
        q("Communicating change honestly – no slogans"),
        q("About people, not prompts"),
      ],
      outcomes: [],
      format: q("In-person or online · half-day to multi-day"),
      language: q("English, Polish, and German", "We work in English, Polish, and German, across Europe."),
    },
  },
  {
    name: "Culture & Leadership Advisory",
    summary: {
      audience: q(
        "Leadership teams building a healthy organisation",
        "Ongoing partnership for leadership teams building a healthy organisation – on purpose, not by accident.",
      ),
      problem: q(
        "Ongoing partnership for leadership teams building a healthy organisation – on purpose, not by accident.",
      ),
      keyPoints: [
        q("Culture diagnosis deeper than slogans"),
        q("Leadership team: trust, conflict, alignment"),
        q("Workshops, facilitation & sparring on call"),
      ],
      outcomes: [],
      format: q(
        "Ongoing partnership: workshops, facilitation & sparring on call",
        "Workshops, facilitation & sparring on call",
      ),
      language: q("English, Polish, and German", "We work in English, Polish, and German, across Europe."),
    },
  },
];

const FACTS = [
  {
    text: "Mind the Gap offers leadership development, team effectiveness and culture advisory: consulting plus hands-on workshops, built around the client's context.",
    source: SITE,
  },
  { text: "Sessions are delivered in English, Polish or German.", source: SITE },
  { text: "A free 30-minute discovery call, no commitment.", source: SITE },
  {
    text: "Works with groups from 5 to 100 people; single workshops or programmes over several weeks or months.",
    source: SITE,
  },
  {
    text: "Sessions in person or online, from half a day to several days, followed by post-session materials and practical tools.",
    source: SITE,
  },
  {
    text: "Years of experience in the room with leaders and teams inside fast-growing tech companies in Europe.",
    source: SITE,
  },
  {
    text: "8 years of experience in training and development.",
    source: "Brief od właściciela (2026-10-15) — potwierdź przed użyciem",
  },
  {
    text: "Previous experience working at TikTok (never implies any endorsement by TikTok).",
    source: "Brief od właściciela (2026-10-15) — potwierdź przed użyciem",
  },
];

let created = 0;
for (const p of PROGRAMS) {
  const [exists] = await db()
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.name, p.name))
    .limit(1);
  if (exists) continue;
  await db()
    .insert(programs)
    .values({
      name: p.name,
      status: "draft",
      summary: p.summary,
      summarySource: `Strona ${SITE} (odczyt ${READ}) — do zatwierdzenia`,
    });
  created++;
}

const [profileRow] = await db().select().from(settings).where(eq(settings.key, "profile")).limit(1);
if (!profileRow) {
  const current = await getSettings("profile");
  await saveSettings("profile", {
    ...current,
    businessName: "Mind the Gap",
    website: SITE,
    facts: FACTS.map((f, i) => ({ id: `seed-${i + 1}`, text: f.text, source: f.source, approved: false })),
    defaultCtaPl: "Krótka, 30-minutowa rozmowa, żeby sprawdzić, czy to pasuje do Waszej sytuacji.",
    defaultCtaEn: "A short 30-minute call to see whether it fits your situation.",
  });
}
console.log(`programmes created: ${created}; profile ${profileRow ? "kept" : "seeded (facts unapproved)"}`);
await closeDb();
