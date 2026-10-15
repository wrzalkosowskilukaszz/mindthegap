import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, db } from "../src/server/db/client.ts";
import { companies, contacts, suppressions } from "../src/server/db/schema.ts";
import {
  addSuppression,
  backfillRoleFunctions,
  refreshDerived,
  upsertContact,
} from "../src/server/services/contacts.ts";
import { eraseContact } from "../src/server/services/privacy.ts";
import { hasDb, resetDb } from "./db.ts";

describe.skipIf(!hasDb)("contacts persistence", () => {
  let companyId: string;
  beforeEach(async () => {
    await resetDb();
    const [c] = await db()
      .insert(companies)
      .values({ slug: "firma", name: "Firma S.A.", domain: "firma.pl", website: "https://firma.pl/" })
      .returning();
    companyId = c!.id;
  });
  afterAll(closeDb);

  const person = (over: Partial<Parameters<typeof upsertContact>[0]> = {}) =>
    upsertContact({
      companyId,
      kind: "person",
      fullName: "Anna Kowalska",
      title: "Dyrektor HR",
      email: "anna.kowalska@firma.pl",
      emailOrigin: "published_source",
      roleCategory: "decision_maker",
      discoveryMethod: "test",
      evidence: [
        {
          kind: "source_page",
          supports: ["name", "role", "email"],
          url: "https://firma.pl/zarzad",
          quote: "Anna Kowalska Dyrektor HR",
          quoteVerified: true,
        },
      ],
      ...over,
    });

  it("dedupes by email and by name within the company (re-running discovery creates no duplicates)", async () => {
    expect((await person()).action).toBe("created");
    expect((await person()).action).toBe("unchanged");
    expect((await person({ email: null, emailOrigin: "none" })).action).not.toBe("created");
    expect(await db().select().from(contacts)).toHaveLength(1);
  });

  it("never resurfaces a rejected contact", async () => {
    const r = await person();
    if (r.action !== "created") throw new Error("expected created");
    await db().update(contacts).set({ reviewStatus: "rejected" }).where(eq(contacts.id, r.contactId));
    expect(await person()).toMatchObject({ action: "skipped", reason: "rejected" });
  });

  it("respects the suppression list for new contacts and blocks existing ones", async () => {
    await db().insert(suppressions).values({ kind: "domain", value: "firma.pl", reason: "test" });
    expect(await person()).toMatchObject({ action: "skipped", reason: "suppressed" });
    await db().delete(suppressions);
    const r = await person();
    if (r.action !== "created") throw new Error("expected created");
    await addSuppression("email", "anna.kowalska@firma.pl", "opt-out", "opt_out");
    const [c] = await db().select().from(contacts).where(eq(contacts.id, r.contactId));
    expect(c!.quality).toBe("blocked");
    expect(c!.outreachStatus).toBe("do_not_contact");
  });

  it("erasure removes the record but remembers a fingerprint so it is not rediscovered", async () => {
    const r = await person();
    if (r.action !== "created") throw new Error("expected created");
    await eraseContact(r.contactId);
    expect(await db().select().from(contacts)).toHaveLength(0);
    const fp = await db().select().from(suppressions);
    expect(fp.map((s) => s.kind).sort()).toEqual(["email_sha256", "person_sha256"]);
    expect(fp.every((s) => !s.value.includes("anna"))).toBe(true);
    expect(await person()).toMatchObject({ action: "skipped", reason: "suppressed" });
  });

  it("derives quality: published but unverified is usable with caution, never 'ready'", async () => {
    const r = await person();
    if (r.action !== "created") throw new Error("expected created");
    await refreshDerived([r.contactId]);
    const [c] = await db().select().from(contacts).where(eq(contacts.id, r.contactId));
    expect(c!.quality).toBe("caution");
    expect(c!.emailStatus).toBe("not_checked");
  });

  it("stores the department and backfills it for contacts saved without one", async () => {
    const a = await person({ roleFunction: "hr" });
    const b = await upsertContact({
      companyId,
      kind: "department_inbox",
      departmentLabel: "Dział Zakupów",
      email: "zakupy@firma.pl",
      emailOrigin: "published_source",
      roleCategory: "departmental_inbox",
      discoveryMethod: "test",
      evidence: [
        {
          kind: "source_page",
          supports: ["email", "department"],
          url: "https://firma.pl/dla-dostawcow",
          quote: "Dział Zakupów zakupy@firma.pl",
          quoteVerified: true,
        },
      ],
    });
    if (a.action !== "created" || b.action !== "created") throw new Error("expected created");
    const before = await db().select().from(contacts).where(eq(contacts.id, b.contactId));
    expect(before[0]!.roleFunction).toBe("other");
    expect(await backfillRoleFunctions()).toBe(1);
    const rows = await db().select({ id: contacts.id, fn: contacts.roleFunction }).from(contacts);
    expect(Object.fromEntries(rows.map((r) => [r.id, r.fn]))).toEqual({
      [a.contactId]: "hr",
      [b.contactId]: "procurement",
    });
  });
});
