/**
 * Contact persistence: dedupe-aware upsert with provenance, suppression checks, derived fields.
 */
import { and, desc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { assessContact, type ContactFacts, deriveOutreachStatus } from "@/lib/contact-rules";
import { emailDomain, nameKey, normalizeEmail } from "@/lib/normalize";
import { sha256Hex } from "../crypto.ts";
import { db } from "../db/client.ts";
import {
  companies,
  contactEvents,
  contactEvidence,
  contacts,
  inboundMessages,
  messages,
  suppressions,
} from "../db/schema.ts";
import { getSettings } from "../settings.ts";

export type ContactRow = typeof contacts.$inferSelect;
export type EvidenceInput = {
  kind: "source_page" | "provider" | "search_result" | "user" | "import";
  supports: ("name" | "role" | "email" | "employment" | "department" | "invitation")[];
  url?: string | null;
  title?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  quote?: string | null;
  quoteVerified?: boolean;
  sourcePublishedAt?: string | null;
  note?: string | null;
};

export type ContactInput = {
  companyId: string;
  kind: "person" | "department_inbox" | "general_inbox";
  fullName?: string | null;
  title?: string | null;
  departmentLabel?: string | null;
  email?: string | null;
  emailOrigin: ContactRow["emailOrigin"];
  roleCategory: ContactRow["roleCategory"];
  roleRationale?: string | null;
  sourcePublishedAt?: string | null;
  employmentStatus?: ContactRow["employmentStatus"];
  discoveryMethod: string;
  runId?: string | null;
  isDemo?: boolean;
  evidence: EvidenceInput[];
};

export type UpsertOutcome =
  | { action: "created"; contactId: string }
  | { action: "updated"; contactId: string }
  | { action: "unchanged"; contactId: string }
  | { action: "skipped"; reason: "rejected" | "suppressed" | "invalid_email" | "company_excluded" | "conflict"; contactId?: string };

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

export async function suppressionHits(input: {
  email?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  nameKey?: string | null;
}): Promise<string[]> {
  const conds = [];
  const email = normalizeEmail(input.email ?? null);
  if (email) {
    conds.push(and(eq(suppressions.kind, "email"), eq(suppressions.value, email)));
    conds.push(and(eq(suppressions.kind, "email_sha256"), eq(suppressions.value, sha256Hex(`email:${email}`))));
    conds.push(and(eq(suppressions.kind, "domain"), eq(suppressions.value, emailDomain(email))));
  }
  if (input.companyId && input.nameKey) {
    conds.push(and(eq(suppressions.kind, "person_sha256"), eq(suppressions.value, sha256Hex(`person:${input.companyId}:${input.nameKey}`))));
  }
  if (input.companyId) conds.push(and(eq(suppressions.kind, "company"), eq(suppressions.value, input.companyId)));
  if (input.contactId) conds.push(and(eq(suppressions.kind, "contact"), eq(suppressions.value, input.contactId)));
  if (conds.length === 0) return [];
  const rows = await db()
    .select({ kind: suppressions.kind, value: suppressions.value })
    .from(suppressions)
    .where(or(...conds));
  return rows.map((r) => `${r.kind}:${r.value}`);
}

export async function addSuppression(kind: "email" | "domain" | "company" | "contact", value: string, reason: string, source = "user") {
  const v = kind === "email" ? normalizeEmail(value) : value.trim().toLowerCase();
  if (!v) throw new Error("Nieprawidłowa wartość wykluczenia");
  await db().insert(suppressions).values({ kind, value: v, reason, source }).onConflictDoNothing();
  // Re-derive affected contacts.
  let ids: string[] = [];
  if (kind === "email") {
    ids = (await db().select({ id: contacts.id }).from(contacts).where(eq(contacts.emailNormalized, v))).map((r) => r.id);
  } else if (kind === "domain") {
    ids = (
      await db()
        .select({ id: contacts.id })
        .from(contacts)
        .where(sql`split_part(${contacts.emailNormalized}, '@', 2) = ${v}`)
    ).map((r) => r.id);
  } else if (kind === "company") {
    ids = (await db().select({ id: contacts.id }).from(contacts).where(eq(contacts.companyId, v))).map((r) => r.id);
  } else {
    ids = [v];
  }
  await refreshDerived(ids);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function recordContactEvent(contactId: string, type: string, data: Record<string, unknown> = {}) {
  await db().insert(contactEvents).values({ contactId, type, data });
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

async function addEvidence(contactId: string, ev: EvidenceInput[]): Promise<number> {
  let added = 0;
  for (const e of ev) {
    const existing = await db()
      .select({ id: contactEvidence.id })
      .from(contactEvidence)
      .where(
        and(
          eq(contactEvidence.contactId, contactId),
          e.url ? eq(contactEvidence.url, e.url) : sql`${contactEvidence.url} is null`,
          e.quote ? eq(contactEvidence.quote, e.quote) : sql`${contactEvidence.quote} is null`,
          e.providerRef ? eq(contactEvidence.providerRef, e.providerRef) : sql`true`,
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      await db()
        .update(contactEvidence)
        .set({ observedAt: new Date() })
        .where(eq(contactEvidence.id, existing[0]!.id));
      continue;
    }
    await db()
      .insert(contactEvidence)
      .values({
        contactId,
        kind: e.kind,
        supports: e.supports,
        url: e.url ?? null,
        title: e.title ?? null,
        provider: e.provider ?? null,
        providerRef: e.providerRef ?? null,
        quote: e.quote ?? null,
        quoteVerified: e.quoteVerified ?? false,
        sourcePublishedAt: e.sourcePublishedAt ?? null,
        note: e.note ?? null,
      });
    added++;
  }
  return added;
}

function splitName(full: string | null | undefined): { first: string | null; last: string | null } {
  if (!full) return { first: null, last: null };
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { first: parts[0] ?? null, last: null };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

export async function upsertContact(input: ContactInput): Promise<UpsertOutcome> {
  const email = input.email ? normalizeEmail(input.email) : null;
  if (input.email && !email) return { action: "skipped", reason: "invalid_email" };
  const nk = input.kind === "person" ? nameKey(input.fullName) : null;

  const [company] = await db().select().from(companies).where(eq(companies.id, input.companyId)).limit(1);
  if (!company) throw new Error("Unknown company");
  if (company.excluded) return { action: "skipped", reason: "company_excluded" };

  // 1. Existing by email (global), 2. by person name within company.
  let existing: ContactRow | undefined;
  if (email) {
    [existing] = await db().select().from(contacts).where(eq(contacts.emailNormalized, email)).limit(1);
  }
  if (!existing && nk) {
    [existing] = await db()
      .select()
      .from(contacts)
      .where(and(eq(contacts.companyId, input.companyId), eq(contacts.nameKey, nk)))
      .limit(1);
  }

  if (existing) {
    if (existing.reviewStatus === "rejected") return { action: "skipped", reason: "rejected", contactId: existing.id };
    const patch: Partial<typeof contacts.$inferInsert> = {};
    if (existing.companyId !== input.companyId) {
      // Same email seen at another company: keep data, flag the conflict for review.
      const note = `Ten sam adres pojawił się w źródle innej firmy (${company.name}).`;
      if (!existing.conflicts?.includes(note)) patch.conflicts = [existing.conflicts, note].filter(Boolean).join(" ");
    } else {
      if (!existing.title && input.title) patch.title = input.title;
      if (!existing.fullName && input.fullName) {
        patch.fullName = input.fullName;
        const s = splitName(input.fullName);
        patch.firstName = s.first;
        patch.lastName = s.last;
        patch.nameKey = nk;
      }
      if (!existing.email && email) {
        const taken = await db().select({ id: contacts.id }).from(contacts).where(eq(contacts.emailNormalized, email)).limit(1);
        if (taken.length === 0) {
          patch.email = input.email!.trim();
          patch.emailNormalized = email;
          patch.emailOrigin = input.emailOrigin;
          patch.emailStatus = "not_checked";
        }
      } else if (
        existing.emailNormalized === email &&
        existing.emailOrigin === "provider_pattern" &&
        input.emailOrigin === "published_source"
      ) {
        // A published source now confirms a previously predicted address.
        patch.emailOrigin = "published_source";
      }
      if (existing.roleCategory === "uncertain" && input.roleCategory !== "uncertain") {
        patch.roleCategory = input.roleCategory;
        patch.roleRationale = input.roleRationale ?? null;
      }
      if (input.sourcePublishedAt && (!existing.sourcePublishedAt || input.sourcePublishedAt > existing.sourcePublishedAt)) {
        patch.sourcePublishedAt = input.sourcePublishedAt;
      }
      if (input.evidence.some((e) => e.supports.includes("employment") || e.supports.includes("name"))) {
        patch.employmentCheckedAt = new Date();
        if (existing.employmentStatus === "possibly_left" || existing.employmentStatus === "unverified") {
          patch.employmentStatus = input.employmentStatus ?? existing.employmentStatus;
        }
      }
    }
    const added = await addEvidence(existing.id, input.evidence);
    if (Object.keys(patch).length > 0) {
      await db()
        .update(contacts)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(contacts.id, existing.id));
      await recordContactEvent(existing.id, "updated_by_discovery", { fields: Object.keys(patch), method: input.discoveryMethod });
      await refreshDerived([existing.id]);
      return { action: "updated", contactId: existing.id };
    }
    return added > 0 ? { action: "updated", contactId: existing.id } : { action: "unchanged", contactId: existing.id };
  }

  const hits = await suppressionHits({ email, companyId: input.companyId, nameKey: nk });
  if (hits.length > 0) return { action: "skipped", reason: "suppressed" };

  const s = splitName(input.fullName);
  const [row] = await db()
    .insert(contacts)
    .values({
      companyId: input.companyId,
      kind: input.kind,
      fullName: input.fullName ?? null,
      firstName: s.first,
      lastName: s.last,
      nameKey: nk,
      departmentLabel: input.departmentLabel ?? null,
      title: input.title ?? null,
      roleCategory: input.roleCategory,
      roleRationale: input.roleRationale ?? null,
      email: email ? input.email!.trim() : null,
      emailNormalized: email,
      emailOrigin: email ? input.emailOrigin : "none",
      employmentStatus: input.employmentStatus ?? "unverified",
      employmentCheckedAt: input.kind === "person" ? new Date() : null,
      sourcePublishedAt: input.sourcePublishedAt ?? null,
      discoveredByRunId: input.runId ?? null,
      discoveryMethod: input.discoveryMethod,
      isDemo: input.isDemo ?? false,
    })
    .onConflictDoNothing()
    .returning({ id: contacts.id });
  if (!row) return { action: "skipped", reason: "conflict" };
  await addEvidence(row.id, input.evidence);
  await recordContactEvent(row.id, "created", { method: input.discoveryMethod, runId: input.runId ?? null });
  await refreshDerived([row.id]);
  return { action: "created", contactId: row.id };
}

// ---------------------------------------------------------------------------
// Derived fields (quality + outreach status)
// ---------------------------------------------------------------------------

export async function refreshDerived(contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return;
  const policy = await getSettings("freshness");
  const outreach = await getSettings("outreach");
  for (let i = 0; i < contactIds.length; i += 200) {
    const ids = contactIds.slice(i, i + 200);
    const rows = await db().select().from(contacts).where(inArray(contacts.id, ids));
    const msgs = await db()
      .select({ contactId: messages.contactId, status: messages.status, sentAt: messages.sentAt })
      .from(messages)
      .where(inArray(messages.contactId, ids));
    const replies = await db()
      .select({ contactId: inboundMessages.contactId, at: sql<Date>`max(${inboundMessages.receivedAt})` })
      .from(inboundMessages)
      .where(and(inArray(inboundMessages.contactId, ids), eq(inboundMessages.classification, "human_reply")))
      .groupBy(inboundMessages.contactId);
    const replyMap = new Map(replies.map((r) => [r.contactId, r.at ? new Date(r.at) : null]));
    for (const c of rows) {
      const hits = await suppressionHits({ email: c.email, companyId: c.companyId, contactId: c.id });
      const facts: ContactFacts = { ...c, suppressed: hits.length > 0 };
      const a = assessContact(facts, policy);
      const cm = msgs.filter((m) => m.contactId === c.id);
      const lastReply = replyMap.get(c.id) ?? null;
      const status = deriveOutreachStatus({
        doNotContact: c.eligibilityBasis === "do_not_contact" || hits.length > 0,
        messages: cm,
        lastHumanReplyAt: lastReply,
        followUpAt: c.followUpAt,
      });
      const lastSent = cm
        .filter((m) => m.status === "sent" && m.sentAt)
        .reduce<Date | null>((acc, m) => (!acc || m.sentAt! > acc ? m.sentAt : acc), null);
      if (
        a.quality !== c.quality ||
        JSON.stringify(a.reasons) !== JSON.stringify(c.qualityReasons) ||
        status !== c.outreachStatus ||
        (lastSent?.getTime() ?? null) !== (c.lastContactedAt?.getTime() ?? null) ||
        (lastReply?.getTime() ?? null) !== (c.lastReplyAt?.getTime() ?? null)
      ) {
        await db()
          .update(contacts)
          .set({
            quality: a.quality,
            qualityReasons: a.reasons,
            outreachStatus: status,
            lastContactedAt: lastSent,
            lastReplyAt: lastReply,
          })
          .where(eq(contacts.id, c.id));
      }
    }
  }
  void outreach;
}

export async function refreshAllDerived(): Promise<number> {
  const ids = (await db().select({ id: contacts.id }).from(contacts)).map((r) => r.id);
  await refreshDerived(ids);
  return ids.length;
}

// ---------------------------------------------------------------------------
// Company-level awareness
// ---------------------------------------------------------------------------

export type CompanyContactInfo = { contactId: string; who: string; at: Date; status: string };

/** Other people at the same company who received a message within `days` (for the warning). */
export async function recentCompanyOutreach(companyId: string, excludeContactId: string, days: number): Promise<CompanyContactInfo[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db()
    .select({
      contactId: contacts.id,
      fullName: contacts.fullName,
      department: contacts.departmentLabel,
      email: contacts.email,
      sentAt: messages.sentAt,
      status: contacts.outreachStatus,
    })
    .from(messages)
    .innerJoin(contacts, eq(messages.contactId, contacts.id))
    .where(
      and(
        eq(messages.companyId, companyId),
        ne(messages.contactId, excludeContactId),
        isNotNull(messages.sentAt),
        sql`${messages.sentAt} >= ${since}`,
      ),
    )
    .orderBy(desc(messages.sentAt))
    .limit(10);
  return rows.map((r) => ({
    contactId: r.contactId,
    who: r.fullName ?? r.department ?? r.email ?? "kontakt",
    at: r.sentAt!,
    status: r.status,
  }));
}
