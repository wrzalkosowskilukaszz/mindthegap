import { describe, expect, it } from "vitest";
import { assessContact, type ContactFacts, checkSendable, deriveOutreachStatus } from "./contact-rules.ts";

const policy = { emailReverifyDays: 90, employmentRecheckDays: 120, staleWarningDays: 180 };
const now = new Date("2026-10-15T10:00:00Z");
const base: ContactFacts = {
  kind: "person",
  roleCategory: "decision_maker",
  email: "anna@firma.pl",
  emailOrigin: "published_source",
  emailStatus: "valid",
  emailCheckedAt: new Date("2026-10-01T00:00:00Z"),
  employmentStatus: "confirmed_recent",
  employmentCheckedAt: new Date("2026-10-01T00:00:00Z"),
  sourcePublishedAt: null,
  discoveredAt: new Date("2026-10-01T00:00:00Z"),
  reviewStatus: "accepted",
  eligibilityBasis: "consent",
  isDemo: false,
  suppressed: false,
};

describe("contact quality", () => {
  it("is ready only when verified, fresh and relevant", () => {
    expect(assessContact(base, policy, now).quality).toBe("ready");
    expect(assessContact({ ...base, emailStatus: "not_checked" }, policy, now).quality).toBe("caution");
    expect(
      assessContact({ ...base, kind: "general_inbox", roleCategory: "general_routing" }, policy, now).quality,
    ).toBe("caution");
  });
  it("never treats an unverified pattern guess as usable", () => {
    expect(
      assessContact({ ...base, emailOrigin: "provider_pattern", emailStatus: "not_checked" }, policy, now)
        .quality,
    ).toBe("needs_research");
    expect(
      assessContact({ ...base, emailOrigin: "provider_pattern", emailStatus: "valid" }, policy, now).quality,
    ).toBe("caution");
  });
  it("blocks suppressed, invalid, rejected and departed contacts", () => {
    expect(assessContact({ ...base, suppressed: true }, policy, now).quality).toBe("blocked");
    expect(assessContact({ ...base, emailStatus: "invalid" }, policy, now).quality).toBe("blocked");
    expect(assessContact({ ...base, reviewStatus: "rejected" }, policy, now).quality).toBe("blocked");
    expect(assessContact({ ...base, employmentStatus: "left" }, policy, now).quality).toBe("blocked");
  });
  it("flags stale verification", () => {
    const old = { ...base, emailCheckedAt: new Date("2026-05-01T00:00:00Z") };
    expect(assessContact(old, policy, now).quality).toBe("caution");
  });
});

describe("send gate", () => {
  it("requires a documented eligibility basis when configured", () => {
    const r = checkSendable(
      { ...base, eligibilityBasis: "not_assessed" },
      policy,
      { requireEligibilityBasis: true },
      now,
    );
    expect(r.blockers.join(" ")).toMatch(/podstawy/);
  });
  it("blocks demo records and guessed addresses, warns on catch-all and company contact", () => {
    expect(
      checkSendable({ ...base, isDemo: true }, policy, { requireEligibilityBasis: true }, now).blockers
        .length,
    ).toBeGreaterThan(0);
    expect(
      checkSendable(
        { ...base, emailOrigin: "provider_pattern", emailStatus: "unknown" },
        policy,
        { requireEligibilityBasis: true },
        now,
      ).blockers.join(" "),
    ).toMatch(/wzorca/);
    const w = checkSendable(
      { ...base, emailStatus: "catch_all" },
      policy,
      { requireEligibilityBasis: true, recentCompanyContact: { at: now, who: "Jan" } },
      now,
    ).warnings.join(" ");
    expect(w).toMatch(/catch-all/);
    expect(w).toMatch(/W tej firmie/);
  });
});

describe("outreach status", () => {
  const sent = { status: "sent" as const, sentAt: new Date("2026-10-01T00:00:00Z") };
  it("derives statuses in priority order", () => {
    expect(
      deriveOutreachStatus({
        doNotContact: false,
        messages: [],
        lastHumanReplyAt: null,
        followUpAt: null,
        now,
      }),
    ).toBe("not_contacted");
    expect(
      deriveOutreachStatus({
        doNotContact: false,
        messages: [{ status: "draft", sentAt: null }],
        lastHumanReplyAt: null,
        followUpAt: null,
        now,
      }),
    ).toBe("draft_ready");
    expect(
      deriveOutreachStatus({
        doNotContact: false,
        messages: [sent],
        lastHumanReplyAt: null,
        followUpAt: new Date("2026-10-20T00:00:00Z"),
        now,
      }),
    ).toBe("sent");
    expect(
      deriveOutreachStatus({
        doNotContact: false,
        messages: [sent],
        lastHumanReplyAt: null,
        followUpAt: new Date("2026-10-08T00:00:00Z"),
        now,
      }),
    ).toBe("follow_up_due");
    expect(
      deriveOutreachStatus({
        doNotContact: false,
        messages: [sent],
        lastHumanReplyAt: new Date("2026-10-03T00:00:00Z"),
        followUpAt: null,
        now,
      }),
    ).toBe("replied");
    expect(
      deriveOutreachStatus({
        doNotContact: true,
        messages: [sent],
        lastHumanReplyAt: null,
        followUpAt: null,
        now,
      }),
    ).toBe("do_not_contact");
  });
});
