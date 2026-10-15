import { describe, expect, it } from "vitest";
import {
  adLanguage,
  type CareerPrefs,
  classifyLocation,
  extractCvKeywords,
  requiredLanguages,
  scoreJob,
  titleLooksRelevant,
} from "./match.ts";

const prefs: CareerPrefs = {
  roleFamilies: ["learning", "people", "coaching", "creative"],
  locations: ["warsaw", "remote_poland", "eu_relocation"],
  languages: ["en", "pl"],
  workTypes: ["full_time", "freelance"],
  cvKeywords: ["facilitation", "leadership development", "workshop"],
  extraKeywords: [],
  excludeKeywords: [],
};

const en = (s: string) =>
  `${s} You will work with our teams and partners across the region. We are looking for someone who will design and run programmes for our people and their leaders.`;

describe("job matching", () => {
  it("ranks an L&D role in Warsaw high, with reasons", () => {
    const m = scoreJob(
      {
        title: "Learning & Development Manager",
        description: en("Lead leadership development and facilitation of workshop series."),
        location: "Warsaw, Poland (hybrid)",
        companyName: "Acme",
      },
      prefs,
    );
    expect(m.eligible).toBe(true);
    expect(m.score).toBeGreaterThanOrEqual(70);
    expect(m.reasons.map((r) => r.text)).toEqual(
      expect.arrayContaining(["L&D / rozwój liderów", "Warszawa · hybrydowo"]),
    );
  });

  it("keeps engineering roles out, even at a favourite company in Warsaw", () => {
    expect(titleLooksRelevant("Staff Software Engineer 6 - Java Platform Team", prefs, true)).toBe(false);
    const m = scoreJob(
      {
        title: "Staff Software Engineer 6 - Java Platform Team",
        description: en("Build distributed systems."),
        location: "Warsaw,Poland",
        companyName: "Netflix",
        favourite: true,
        companySector: "telecom_media",
      },
      prefs,
    );
    expect(m.score).toBeLessThan(40);
  });

  it("accepts remote roles open to Europe and rejects US-only or UK roles", () => {
    expect(classifyLocation({ location: "Remote - EMEA" })).toBe("remote_ok");
    expect(classifyLocation({ location: "Remote", countries: ["PL", "DE"], workplace: "remote" })).toBe(
      "remote_ok",
    );
    expect(classifyLocation({ location: "Remote (US only)" })).toBe("non_eu");
    expect(classifyLocation({ location: "London, United Kingdom" })).toBe("non_eu");
    expect(classifyLocation({ location: "Kraków" })).toBe("poland");
    expect(classifyLocation({ location: "Berlin, Germany" })).toBe("eu");
    const uk = scoreJob(
      {
        title: "Learning Partner",
        description: en("Facilitation."),
        location: "London, UK",
        companyName: "X",
      },
      prefs,
    );
    expect(uk.eligible).toBe(false);
    expect(uk.score).toBe(0);
  });

  it("respects the chosen places: other Polish cities only when switched on", () => {
    const job = { title: "Trener biznesu", description: en(""), location: "Kraków", companyName: "X" };
    expect(scoreJob(job, prefs).eligible).toBe(false);
    expect(scoreJob(job, { ...prefs, locations: [...prefs.locations, "poland_other"] }).eligible).toBe(true);
  });

  it("marks German-language ads and required languages you do not speak", () => {
    const de =
      "Wir suchen eine Trainerin für unsere Teams. Sie sind verantwortlich für die Entwicklung und Durchführung von Workshops und Schulungen für Führungskräfte in der Region. Fließende Deutschkenntnisse sind erforderlich und wir bieten eine tolle Arbeit mit der Möglichkeit für Wachstum.";
    expect(adLanguage(de)).toBe("de");
    expect(requiredLanguages("Fluent German and English are required.")).toEqual(
      expect.arrayContaining(["de", "en"]),
    );
    const m = scoreJob(
      { title: "Learning & Development Specialist", description: de, location: "Berlin", companyName: "X" },
      prefs,
    );
    expect(m.eligible).toBe(true);
    expect(m.reasons.some((r) => r.tone === "bad" && /niemieck/.test(r.text))).toBe(true);
  });

  it("finds known topic words in a CV", () => {
    const k = extractCvKeywords(
      "Facilitator and trainer. Leadership development programmes, workshop design, coaching, OKR, TikTok.",
    );
    expect(k).toEqual(
      expect.arrayContaining(["leadership development", "coaching", "facilitator", "tiktok"]),
    );
  });
});
