import { describe, expect, it } from "vitest";
import { lintEmail } from "@/lib/email-lint";
import { type TemplateInput, templateDraft } from "./templates.ts";

const base: TemplateInput = {
  language: "pl",
  kind: "initial",
  seed: "contact-1",
  recipient: { kind: "person", firstName: "Anna", salutation: "neutral", fn: "hr" },
  company: "Firma Polska",
  program: null,
  businessName: "Mind the Gap",
  senderName: "",
  hasSignature: false,
  previousSentAt: null,
  threadSubject: null,
};

const lint = (t: TemplateInput) => {
  const d = templateDraft(t);
  return lintEmail(d.subjects[0]!, d.body, {
    language: t.language,
    factsCorpus: "",
    allowedUrls: [],
    isReplyInThread: t.kind === "follow_up",
    hasPreviousMessages: t.kind === "follow_up",
    tiktokApproved: false,
    avoidPhrases: [],
    kind: t.kind,
  });
};

describe("template drafts (no AI)", () => {
  it("writes a Polish first email with two subjects and a neutral greeting", () => {
    const d = templateDraft(base);
    expect(d.subjects).toHaveLength(2);
    expect(d.body.startsWith("Dzień dobry,\n\n")).toBe(true);
    expect(d.body).toContain("w firmie Firma Polska");
    expect(d.body).not.toMatch(/Pan\b|Pani\b/); // no guessed gender
    expect(d.variants[0]?.body.length).toBeLessThan(d.body.length);
  });

  it("asks procurement for the right person or the supplier process", () => {
    const d = templateDraft({ ...base, recipient: { ...base.recipient, fn: "procurement" } });
    expect(d.body).toContain("rejestracji dostawców");
    expect(d.subjects[0]).toMatch(/Dostawca/);
  });

  it("asks a department mailbox to forward the message", () => {
    const d = templateDraft({
      ...base,
      recipient: { ...base.recipient, kind: "department_inbox", firstName: null },
    });
    expect(d.body).toContain("piszę do działu HR");
    expect(d.body).toContain("proszę o przekazanie");
  });

  it("writes English with the first name when known and mentions the programme", () => {
    const d = templateDraft({ ...base, language: "en", program: "Team Reset" });
    expect(d.body.startsWith("Hi Anna,")).toBe(true);
    expect(d.body).toContain('"Team Reset"');
    expect(d.subjects[0]).toContain("Team Reset");
  });

  it("varies wording between contacts", () => {
    const bodies = new Set(
      ["a", "b", "c", "d", "e", "f"].map((seed) => templateDraft({ ...base, seed }).body),
    );
    expect(bodies.size).toBeGreaterThan(1);
  });

  it("adds a closing line only when there is no own signature; the name comes in the signature", () => {
    expect(templateDraft({ ...base, senderName: "Jan" }).body.endsWith("Pozdrawiam serdecznie")).toBe(true);
    expect(templateDraft({ ...base, hasSignature: true }).body).not.toContain("Pozdrawiam");
  });

  it.each(["pl", "en"] as const)(
    "passes the email checks without errors (%s, every department)",
    (language) => {
      for (const fn of [
        "hr",
        "learning",
        "procurement",
        "business_leadership",
        "transformation",
        "people_culture",
        "other",
      ] as const) {
        for (const kind of ["initial", "follow_up"] as const) {
          const findings = lint({
            ...base,
            language,
            kind,
            recipient: { ...base.recipient, fn },
            threadSubject: kind === "follow_up" ? "Rozwój menedżerów" : null,
          });
          expect(
            findings.filter((f) => f.level === "error"),
            `${fn} ${kind}`,
          ).toEqual([]);
          expect(
            findings.filter((f) => f.code === "number"),
            `${fn} ${kind}`,
          ).toEqual([]);
        }
      }
    },
  );
});
