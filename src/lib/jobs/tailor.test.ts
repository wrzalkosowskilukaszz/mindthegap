import { describe, expect, it } from "vitest";
import { cvGap, splitTailored } from "./tailor.ts";

const offer = {
  title: "Learning & Development Partner",
  description:
    "You will design leadership development programmes, run workshops and manage our LMS (Docebo). " +
    "Experience with Articulate 360 and change management is a plus. Fluent German is required. " +
    "During the workday you will excel at stakeholder management. We aid our teams.",
};

describe("CV gap for one offer", () => {
  it("splits the offer's skills into what the CV shows and what it does not", () => {
    const cv =
      "Trenerka i facylitatorka. Prowadzę warsztaty i programy rozwoju liderów, rozwój przywództwa. " +
      "Pracowałam ze stakeholderami w firmie. Języki: angielski C1.";
    const g = cvGap(offer, cv);
    expect(g.inCv).toEqual(
      expect.arrayContaining(["warsztaty", "leadership development", "praca z interesariuszami"]),
    );
    expect(g.missing).toEqual(
      expect.arrayContaining([
        "LMS / LXP",
        "Docebo",
        "Articulate / Storyline / Rise",
        "change management",
        "język niemiecki",
      ]),
    );
  });

  it("does not count ordinary words as tools", () => {
    const g = cvGap(offer, "");
    const all = [...g.inCv, ...g.missing];
    expect(all).not.toContain("Workday"); // "during the workday"
    expect(all).not.toContain("narzędzia AI"); // "aid"
  });

  it("counts a language the CV is written in", () => {
    const g = cvGap(
      { title: "Coach", description: "Fluent English is required for this coaching role with our clients." },
      "I am a coach and a facilitator with ten years of experience. I have worked with the teams and the " +
        "leaders of the largest companies in the region, and I have designed programmes for them that are " +
        "still running in the company.",
    );
    expect(g.inCv).toContain("język angielski");
    expect(g.inCv).toContain("coaching");
  });
});

describe("pasted AI answer", () => {
  it("keeps the CV and lifts out the 'Do sprawdzenia' notes", () => {
    const r = splitTailored(
      "# Anna Nowak\n\n## Doświadczenie\n- **Trener** — 2020–2024\n\n---\n\n## Do sprawdzenia\n1. Oferta wymaga **Docebo**.\n- Zmieniono opis roli.\n",
    );
    expect(r.cv).toBe("# Anna Nowak\n\n## Doświadczenie\n- **Trener** — 2020–2024");
    expect(r.checks).toEqual(["Oferta wymaga Docebo.", "Zmieniono opis roli."]);
  });

  it("returns the whole text when there are no notes", () => {
    expect(splitTailored("  CV text \n")).toEqual({ cv: "CV text", checks: [] });
  });
});
