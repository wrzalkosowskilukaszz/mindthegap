import { describe, expect, it } from "vitest";
import { type LintContext, lintEmail } from "./email-lint.ts";

const ctx: LintContext = {
  language: "pl",
  factsCorpus: "Free 30-minute discovery call. Works with groups from 5 to 100 people.",
  allowedUrls: ["https://leadersmindthegap.com/"],
  isReplyInThread: false,
  hasPreviousMessages: false,
  tiktokApproved: false,
  avoidPhrases: ["synergia"],
  kind: "initial",
};
const body = (s: string) =>
  `Dzień dobry,\n\n${s}\n\nCzy krótka rozmowa miałaby sens w przyszłym tygodniu? To spokojna, niezobowiązująca propozycja, bez presji czasowej, aby ocenić dopasowanie do potrzeb zespołu i menedżerów.`;
const codes = (subject: string, b: string, c: Partial<LintContext> = {}) =>
  lintEmail(subject, b, { ...ctx, ...c }).map((f) => f.code);

describe("email lint", () => {
  it("accepts a clean email", () => {
    expect(
      lintEmail(
        "Menedżerowie w czasie zmian",
        body("Pracuję z liderami zespołów, którzy prowadzą ludzi przez zmiany."),
        ctx,
      ).filter((f) => f.level === "error"),
    ).toEqual([]);
  });
  it("blocks fake Re:, invented numbers, foreign links, urgency and guarantees", () => {
    expect(codes("Re: rozmowa", body("Treść."))).toContain("fake_thread");
    expect(codes("Temat", body("Pomogliśmy 40 firmom."))).toContain("number");
    expect(codes("Temat", body("Rozmowa trwa 30 minut."))).not.toContain("number");
    expect(codes("Temat", body("Zobacz https://example.com/oferta"))).toContain("url");
    expect(codes("Temat", body("Zobacz https://leadersmindthegap.com/"))).not.toContain("url");
    expect(codes("Temat", body("Zostały ostatnie miejsca!"))).toContain("urgency");
    expect(codes("Temat", body("Gwarantujemy efekty."))).toContain("guarantee");
  });
  it("blocks claims about earlier messages that never happened", () => {
    expect(codes("Temat", body("Nawiązując do mojej poprzedniej wiadomości."))).toContain("prior_reading");
  });
  it("guards TikTok mentions", () => {
    expect(codes("Temat", body("Pracowałam w TikToku."))).toContain("tiktok");
    expect(codes("Temat", body("TikTok poleca nasze szkolenia."), { tiktokApproved: true })).toContain(
      "tiktok_endorsement",
    );
  });
  it("warns about clichés and avoided phrases", () => {
    expect(codes("Temat", body("Mam nadzieję, że ta wiadomość zastaje Panią w dobrym zdrowiu."))).toContain(
      "cliche",
    );
    expect(codes("Temat", body("To czysta synergia."))).toContain("avoid_phrase");
  });
});
