/**
 * Privacy operations: retention, erasure with exclusion memory, export.
 * Erased people are remembered only as SHA-256 fingerprints so discovery doesn't bring them back.
 */
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { sha256Hex } from "../crypto.ts";
import { db } from "../db/client.ts";
import {
  companies,
  contactEvents,
  contactEvidence,
  contacts,
  contactVerifications,
  inboundMessages,
  messages,
  notes,
  reminders,
  suppressions,
} from "../db/schema.ts";
import { getSettings } from "../settings.ts";

export function emailFingerprint(email: string): string {
  return sha256Hex(`email:${email.trim().toLowerCase()}`);
}
export function personFingerprint(companyId: string, nameKey: string): string {
  return sha256Hex(`person:${companyId}:${nameKey}`);
}

async function rememberAndDelete(ids: string[], reason: string, source: string): Promise<number> {
  if (!ids.length) return 0;
  const rows = await db().select().from(contacts).where(inArray(contacts.id, ids));
  for (const c of rows) {
    if (c.emailNormalized) {
      await db().insert(suppressions).values({ kind: "email_sha256", value: emailFingerprint(c.emailNormalized), reason, source }).onConflictDoNothing();
    }
    if (c.nameKey) {
      await db().insert(suppressions).values({ kind: "person_sha256", value: personFingerprint(c.companyId, c.nameKey), reason, source }).onConflictDoNothing();
    }
  }
  await db().delete(contacts).where(inArray(contacts.id, ids));
  return rows.length;
}

/** Erasure on request: removes the contact, its evidence, notes and correspondence records. */
export async function eraseContact(contactId: string, reason = "Usunięty na żądanie"): Promise<number> {
  return rememberAndDelete([contactId], reason, "erasure");
}

/** Configurable retention: never-contacted, not-accepted contacts and old rejected ones are erased. */
export async function applyRetention(): Promise<{ deleted: number }> {
  const p = await getSettings("privacy");
  const notContacted = await db()
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.outreachStatus, "not_contacted"),
        sql`${contacts.reviewStatus} <> 'accepted'`,
        lt(contacts.discoveredAt, sql`now() - make_interval(months => ${p.retentionMonthsNotContacted})`),
        sql`not exists (select 1 from messages m where m.contact_id = ${contacts.id})`,
      ),
    )
    .limit(500);
  const rejected = await db()
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.reviewStatus, "rejected"), lt(contacts.updatedAt, sql`now() - make_interval(months => ${p.retentionMonthsRejected})`)))
    .limit(500);
  const deleted =
    (await rememberAndDelete(notContacted.map((r) => r.id), "Retencja: brak kontaktu", "retention")) +
    (await rememberAndDelete(rejected.map((r) => r.id), "Retencja: odrzucony", "retention"));
  return { deleted };
}

/** Everything stored about one contact (access request / portability). */
export async function exportContact(contactId: string) {
  const [c] = await db().select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!c) return null;
  const [co] = await db().select({ name: companies.name, domain: companies.domain }).from(companies).where(eq(companies.id, c.companyId));
  return {
    exportedAt: new Date().toISOString(),
    contact: c,
    company: co,
    evidence: await db().select().from(contactEvidence).where(eq(contactEvidence.contactId, contactId)),
    verifications: await db().select().from(contactVerifications).where(eq(contactVerifications.contactId, contactId)),
    events: await db().select().from(contactEvents).where(eq(contactEvents.contactId, contactId)),
    notes: await db().select().from(notes).where(eq(notes.contactId, contactId)),
    reminders: await db().select().from(reminders).where(eq(reminders.contactId, contactId)),
    messages: await db().select().from(messages).where(eq(messages.contactId, contactId)),
    inbound: await db().select().from(inboundMessages).where(eq(inboundMessages.contactId, contactId)),
  };
}
