/**
 * Provider enrichment (paid, budgeted). Keeps provenance: provider id + every source URI the provider
 * reports. Pattern-predicted addresses are marked "provider_pattern" and never treated as ready.
 */
import { eq } from "drizzle-orm";
import { assessRole } from "@/lib/roles";
import { normalizeEmail } from "@/lib/normalize";
import { db } from "../db/client.ts";
import { companies, contactEvidence, contacts } from "../db/schema.ts";
import { withBudget } from "../jobs/budget.ts";
import { mapHunterStatus } from "../providers/hunter.ts";
import { contactSource } from "../providers/index.ts";
import type { ProviderContact } from "../providers/types.ts";
import { recordContactEvent, refreshDerived, upsertContact } from "../services/contacts.ts";

export type EnrichResult = { status: "found" | "not_found" | "skipped" | "not_configured"; detail?: string; created?: number; contactIds?: string[] };

function evidenceFrom(p: ProviderContact, provider: string) {
  const base = [{ kind: "provider" as const, supports: ["email", "name", "role"] as ("email" | "name" | "role")[], provider, providerRef: p.providerRef, note: p.confidence != null ? `pewność dostawcy: ${p.confidence}` : null }];
  const srcs = p.sources.slice(0, 5).map((s) => ({
    kind: "provider" as const,
    supports: ["email"] as "email"[],
    provider,
    providerRef: p.providerRef,
    url: s.uri,
    sourcePublishedAt: s.lastSeenOn ?? s.extractedOn ?? null,
    note: s.stillOnPage === false ? "źródło: adres już nie widnieje na stronie" : null,
  }));
  return [...base, ...srcs];
}

export async function enrichPerson(contactId: string, ctx: { runId?: string | null; taskId?: string | null }): Promise<EnrichResult> {
  const src = contactSource();
  if (!src) return { status: "not_configured" };
  const [c] = await db().select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!c || c.kind !== "person" || c.emailNormalized || !c.firstName || !c.lastName) return { status: "skipped" };
  const [co] = await db().select().from(companies).where(eq(companies.id, c.companyId)).limit(1);
  if (!co) return { status: "skipped" };
  const res = await withBudget(
    { provider: src.name, operation: "email-finder", credits: src.creditsPerFinder, runId: ctx.runId, taskId: ctx.taskId, detail: contactId },
    async () => {
      const r = await src.emailFinder(co.domain, c.firstName!, c.lastName!);
      return { value: r.contact, credits: r.credits };
    },
  );
  if (!res?.email) return { status: "not_found" };
  const email = normalizeEmail(res.email);
  if (!email) return { status: "not_found" };
  const taken = await db().select({ id: contacts.id }).from(contacts).where(eq(contacts.emailNormalized, email)).limit(1);
  if (taken.length) return { status: "skipped", detail: "adres już przypisany innemu kontaktowi" };
  const origin = res.sources.length > 0 ? "provider_with_sources" : "provider_pattern";
  await db()
    .update(contacts)
    .set({
      email: res.email,
      emailNormalized: email,
      emailOrigin: origin,
      emailStatus: res.verification?.status ? mapHunterStatus(res.verification.status) : "not_checked",
      emailCheckedAt: res.verification?.date ? new Date(res.verification.date) : null,
      emailProviderResult: { provider: src.name, raw: res.raw, at: new Date().toISOString() },
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, contactId));
  for (const e of evidenceFrom(res, src.name)) {
    const row: typeof contactEvidence.$inferInsert = {
      contactId,
      kind: e.kind,
      supports: [...e.supports],
      provider: e.provider,
      providerRef: e.providerRef,
      url: "url" in e ? ((e.url as string | null | undefined) ?? null) : null,
      sourcePublishedAt: "sourcePublishedAt" in e ? ((e.sourcePublishedAt as string | null | undefined) ?? null) : null,
      note: e.note ?? null,
    };
    await db().insert(contactEvidence).values(row);
  }
  await recordContactEvent(contactId, "email_enriched", { provider: src.name, origin });
  await refreshDerived([contactId]);
  return { status: "found", detail: origin };
}

/** Domain search for relevant roles at a company with no relevant contact yet. */
export async function enrichCompany(companyId: string, ctx: { runId?: string | null; taskId?: string | null; maxContacts: number }): Promise<EnrichResult> {
  const src = contactSource();
  if (!src) return { status: "not_configured" };
  const [co] = await db().select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!co || co.excluded) return { status: "skipped" };
  const res = await withBudget(
    { provider: src.name, operation: "domain-search", credits: src.creditsPerDomainSearch, runId: ctx.runId, taskId: ctx.taskId, detail: co.domain },
    async () => {
      const r = await src.domainSearch(co.domain, { departments: ["hr", "management", "executive"], seniority: ["senior", "executive"], limit: 10 });
      return { value: r, credits: r.credits };
    },
  );
  let created = 0;
  const ids: string[] = [];
  const relevant = res.contacts
    .map((p) => ({ p, role: assessRole(p.position) }))
    .filter((x) => x.role.relevant && x.p.email)
    .sort((a, b) => (a.role.category === "decision_maker" ? -1 : 0) - (b.role.category === "decision_maker" ? -1 : 0))
    .slice(0, ctx.maxContacts);
  for (const { p, role } of relevant) {
    const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ") || null;
    const stillListed = p.sources.some((s) => s.stillOnPage);
    const out = await upsertContact({
      companyId,
      kind: fullName ? "person" : "department_inbox",
      fullName,
      title: p.position,
      email: p.email,
      emailOrigin: p.sources.length ? "provider_with_sources" : "provider_pattern",
      roleCategory: fullName ? role.category : "departmental_inbox",
      roleRationale: `${role.label} (stanowisko wg dostawcy)`,
      employmentStatus: stillListed ? "dated_evidence" : "unverified",
      sourcePublishedAt: p.sources[0]?.lastSeenOn ?? null,
      discoveryMethod: `provider_${src.name}`,
      runId: ctx.runId,
      evidence: evidenceFrom(p, src.name),
    });
    if (out.action === "created") {
      created++;
      ids.push(out.contactId);
      if (p.verification?.status) {
        await db()
          .update(contacts)
          .set({ emailStatus: mapHunterStatus(p.verification.status), emailCheckedAt: p.verification.date ? new Date(p.verification.date) : null })
          .where(eq(contacts.id, out.contactId));
        await refreshDerived([out.contactId]);
      }
    }
  }
  return { status: created ? "found" : "not_found", created, contactIds: ids, detail: `${res.contacts.length} wyników, ${relevant.length} trafnych` };
}
