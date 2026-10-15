import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the network layer: no real Gmail call is ever made in tests.
const fetchMock = vi.fn();
vi.mock("../src/server/providers/http.ts", async (orig) => {
  const real = await orig<typeof import("../src/server/providers/http.ts")>();
  return { ...real, httpFetch: (...args: unknown[]) => fetchMock(...args) };
});

const { closeDb, db } = await import("../src/server/db/client.ts");
const { companies, contacts, googleAccounts, messages, reminders } = await import(
  "../src/server/db/schema.ts"
);
const { encryptSecret } = await import("../src/server/crypto.ts");
const { resetEnvCache } = await import("../src/server/env.ts");
const { approve, createDraft, finalText, getMessage, signatureFor, updateDraft } = await import(
  "../src/server/services/messages.ts"
);
const { markSentManually, sendMessage } = await import("../src/server/gmail/dispatch.ts");
const { saveSettings } = await import("../src/server/settings.ts");
const { hasDb, resetDb } = await import("./db.ts");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe.skipIf(!hasDb)("messages and sending", () => {
  let contactId: string;
  beforeEach(async () => {
    await resetDb();
    fetchMock.mockReset();
    process.env.SENDING_ENABLED = "true";
    resetEnvCache();
    const [co] = await db()
      .insert(companies)
      .values({ slug: "firma", name: "Firma", domain: "firma.pl" })
      .returning();
    const [c] = await db()
      .insert(contacts)
      .values({
        companyId: co!.id,
        kind: "person",
        fullName: "Anna Kowalska",
        email: "anna@firma.pl",
        emailNormalized: "anna@firma.pl",
        emailOrigin: "published_source",
        emailStatus: "valid",
        emailCheckedAt: new Date(),
        roleCategory: "decision_maker",
        employmentStatus: "confirmed_recent",
        employmentCheckedAt: new Date(),
        reviewStatus: "accepted",
      })
      .returning();
    contactId = c!.id;
    await saveSettings("profile", {
      senderName: "Julia",
      signaturePl: "Julia\nMind the Gap",
      businessName: "Mind the Gap",
      website: "https://leadersmindthegap.com/",
    });
    await db()
      .insert(googleAccounts)
      .values({
        email: "owner@example.com",
        scopes: ["openid", "email", "https://www.googleapis.com/auth/gmail.send"],
        accessTokenEnc: encryptSecret("token"),
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
        refreshTokenEnc: encryptSecret("refresh"),
      });
  });
  afterAll(async () => {
    process.env.SENDING_ENABLED = "false";
    await closeDb();
  });

  async function approvedDraft() {
    const m = await createDraft({ contactId, programId: null, language: "pl" });
    await updateDraft(m.id, {
      subject: "Menedżerowie w czasie zmian",
      body: "Dzień dobry,\n\nkrótka wiadomość testowa o rozwoju menedżerów.",
      revision: m.revision,
    });
    await db()
      .update(contacts)
      .set({
        eligibilityBasis: "consent",
        eligibilityEvidence: "Zgoda z rozmowy",
        eligibilityDate: "2026-10-01",
      })
      .where(eq(contacts.id, contactId));
    return approve(m.id, { acknowledgeWarnings: true, lint: [] });
  }

  it("requires a documented basis, and any edit voids the approval", async () => {
    const m = await createDraft({ contactId, programId: null, language: "pl" });
    const u = await updateDraft(m.id, { subject: "Temat", body: "Treść testowa.", revision: m.revision });
    await expect(approve(m.id, { acknowledgeWarnings: true, lint: [] })).rejects.toMatchObject({
      status: 400,
    });
    await db().update(contacts).set({ eligibilityBasis: "consent" }).where(eq(contacts.id, contactId));
    const a = await approve(m.id, { acknowledgeWarnings: true, lint: [] });
    expect(a.status).toBe("approved");
    await updateDraft(m.id, { body: "Zmieniona treść.", revision: a.revision });
    expect((await getMessage(m.id)).status).toBe("draft");
    expect(u.revision).toBe(1);
  });

  it("rejects stale autosaves (optimistic concurrency)", async () => {
    const m = await createDraft({ contactId, programId: null, language: "pl" });
    await updateDraft(m.id, { body: "A", revision: 0 });
    await expect(updateDraft(m.id, { body: "B", revision: 0 })).rejects.toMatchObject({ status: 409 });
  });

  it("final text adds the signature and the first-contact privacy notice", async () => {
    const m = await approvedDraft();
    const t = await finalText(m);
    expect(t).toContain("Julia\nMind the Gap");
    expect(t).toMatch(/publicznie dostępnego źródła/);
  });

  it("builds the signature from name, position and company when none is written", async () => {
    const { ProfileSettings } = await import("../src/server/settings.ts");
    const p = ProfileSettings.parse({
      senderName: "Julia Krasniuk",
      senderRole: "Trenerka",
      businessName: "Mind the Gap",
      website: "https://leadersmindthegap.com/",
    });
    expect(signatureFor(p, "pl")).toEqual({
      text: "Julia Krasniuk\nTrenerka · Mind the Gap\nhttps://leadersmindthegap.com",
      auto: true,
    });
    expect(signatureFor({ ...p, signatureEn: "Julia" }, "en")).toEqual({ text: "Julia", auto: false });
  });

  it("sends once through Gmail and records the thread", async () => {
    const m = await approvedDraft();
    fetchMock.mockResolvedValueOnce(json(200, { id: "g1", threadId: "t1", labelIds: ["SENT"] }));
    expect((await sendMessage(m.id)).status).toBe("sent");
    const sent = await getMessage(m.id);
    expect(sent).toMatchObject({ status: "sent", sentVia: "gmail", gmailThreadId: "t1" });
    expect(await db().select().from(reminders)).toHaveLength(1);
    await expect(sendMessage(m.id)).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("an uncertain result is never retried automatically", async () => {
    const m = await approvedDraft();
    fetchMock.mockRejectedValueOnce(new Error("socket hang up"));
    expect((await sendMessage(m.id)).status).toBe("uncertain");
    await expect(sendMessage(m.id)).rejects.toMatchObject({ status: 409 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a rejected request is marked failed; the safety switch blocks sending entirely", async () => {
    const m = await approvedDraft();
    fetchMock.mockResolvedValueOnce(json(400, { error: { message: "Invalid To header" } }));
    expect((await sendMessage(m.id)).status).toBe("failed");
    process.env.SENDING_ENABLED = "false";
    resetEnvCache();
    const m2 = await approvedDraft();
    expect((await sendMessage(m2.id)).status).toBe("blocked");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("without Gmail: an approved message can be marked as sent manually", async () => {
    const m = await approvedDraft();
    await markSentManually(m.id, new Date());
    expect(await getMessage(m.id)).toMatchObject({ status: "sent", sentVia: "manual" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("suppressed contacts can't even get a draft", async () => {
    await db().update(contacts).set({ eligibilityBasis: "do_not_contact" }).where(eq(contacts.id, contactId));
    await expect(createDraft({ contactId, programId: null, language: "pl" })).rejects.toMatchObject({
      status: 400,
    });
    expect(await db().select().from(messages)).toHaveLength(0);
  });
});
