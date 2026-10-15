import { describe, expect, it } from "vitest";
import { daysLeft, scoreTender } from "./match.ts";

describe("request-for-quotes relevance", () => {
  it("ranks leadership and coaching work for companies high", () => {
    const m = scoreTender({
      title: "Realizacja szkolenia „Akademia menedżera” – coaching i warsztaty dla kadry zarządzającej",
      text: "Szkolenia dla pracowników przedsiębiorstwa z zakresu komunikacji i zarządzania zespołem.",
      place: "Cała Polska",
    });
    expect(m.score).toBeGreaterThanOrEqual(80);
    expect(m.topics).toEqual(expect.arrayContaining(["coaching", "przywództwo / menedżerowie", "warsztaty"]));
    expect(m.reasons.some((r) => r.text === "Cała Polska" && r.tone === "good")).toBe(true);
  });

  it("pushes vocational, language and school work down and says why", () => {
    for (const title of [
      "Szkolenie zawodowe „Operator wózków widłowych” z egzaminem UDT",
      "Kurs języka angielskiego na poziomie B1",
      "Warsztaty rozwoju osobistego dla uczniów w roku szkolnym 2026/2027",
      "Kompleksowa usługa hotelowo-konferencyjna dla uczestników szkoleń",
    ]) {
      const m = scoreTender({
        title,
        text: "Zajęcia prowadzone przez doświadczonego trenera.",
        place: "Lublin, lubelskie",
      });
      expect(m.score, title).toBeLessThan(45);
      expect(
        m.reasons.some((r) => r.tone === "bad"),
        title,
      ).toBe(true);
    }
  });

  it("caps what a long description adds and keeps catering mentions in the text harmless", () => {
    const long =
      "komunikacja warsztaty mentoring negocjacje asertywność motywacja feedback stres kreatywność";
    const m = scoreTender({ title: "Zapytanie ofertowe nr 3/2026", text: long, place: null });
    expect(m.score).toBeLessThanOrEqual(25 + 30 + 6);
    const withCatering = scoreTender({
      title: "Szkolenia z komunikacji dla pracowników",
      text: "Wykonawca zapewni salę i catering.",
      place: "Warszawa, mazowieckie",
    });
    expect(withCatering.reasons.some((r) => r.tone === "bad")).toBe(false);
  });

  it("flags a training-register requirement and counts days left", () => {
    const m = scoreTender({
      title: "Szkolenia z komunikacji",
      text: "",
      place: null,
      conditions: ["Wykonawca posiada wpis do Rejestru Instytucji Szkoleniowych"],
    });
    expect(m.reasons).toContainEqual({ text: "Wymaga wpisu do RIS", tone: "warn" });
    expect(daysLeft(new Date("2026-10-20T10:00:00Z"), new Date("2026-10-15T09:00:00Z"))).toBe(5);
  });
});
