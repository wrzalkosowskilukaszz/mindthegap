import { describe, expect, it } from "vitest";
import { scoreEvent } from "./match.ts";

describe("event relevance", () => {
  it("ranks HR and L&D gatherings in Warsaw high, with reasons", () => {
    const m = scoreEvent({
      title: "Kongres Profesjonalistów HR – networking dyrektorów HR",
      text: "Dla menedżerów L&D i HR Business Partnerów.",
      organiser: null,
      place: "Courtyard by Marriott, Warszawa",
      online: false,
    });
    expect(m.score).toBeGreaterThanOrEqual(70);
    expect(m.reasons.map((r) => r.text)).toEqual(expect.arrayContaining(["Warszawa", "networking"]));
  });

  it("pushes job fairs, developer meetups and payroll conferences down", () => {
    for (const title of [
      "Targi Pracy jesień 2026",
      "React & JavaScript Warsaw Meetup",
      "Konferencja Kadry i Płace 2027 – zmiany w ZUS",
    ]) {
      const m = scoreEvent({
        title,
        text: "Spotkanie dla HR",
        organiser: null,
        place: "Warszawa",
        online: false,
      });
      expect(m.score, title).toBeLessThan(45);
      expect(
        m.reasons.some((r) => r.tone === "bad"),
        title,
      ).toBe(true);
    }
  });

  it("counts online events, but less than Warsaw", () => {
    const base = { title: "Webinar: coaching w organizacji", text: "", organiser: null };
    const online = scoreEvent({ ...base, place: null, online: true });
    const warsaw = scoreEvent({ ...base, place: "Warszawa", online: false });
    expect(warsaw.score).toBeGreaterThan(online.score);
    expect(online.reasons).toContainEqual({ text: "Online", tone: "good" });
  });
});
