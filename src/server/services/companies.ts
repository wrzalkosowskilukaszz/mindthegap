/** Companies: import from research records, coverage and research outcome. */
import { and, eq, sql } from "drizzle-orm";
import type { CompanyRecord } from "@/lib/research/company-record";
import { db } from "../db/client.ts";
import { companies, companySources, contacts } from "../db/schema.ts";

export type CompanyRow = typeof companies.$inferSelect;

function figure(f: CompanyRecord["employees_global"]) {
  if (!f) return null;
  return { value: f.value, asOf: f.as_of != null ? String(f.as_of) : null, sourceUrl: f.source_url, approx: f.approx };
}

/** Upsert by slug/domain. Research fields from the record win; operational fields are kept. */
export async function upsertCompanyFromRecord(
  r: CompanyRecord,
  origin: CompanyRow["origin"] = "initial_universe",
): Promise<{ id: string; action: "created" | "updated" }> {
  const values = {
    slug: r.id,
    name: r.name,
    brand: r.brand ?? null,
    website: r.website,
    domain: r.domain,
    groupWebsite: r.group_website ?? null,
    sector: r.sector,
    subsector: r.subsector ?? null,
    hqCountry: r.hq_country ?? null,
    polishPresenceSummary: r.polish_presence.summary,
    polishPresenceUrl: r.polish_presence.evidence_url,
    locations: r.polish_presence.locations ?? [],
    parentName: r.parent ?? null,
    relationship: r.relationship ?? null,
    relationshipNote: r.relationship_note ?? null,
    employeesGlobal: figure(r.employees_global),
    employeesPoland: figure(r.employees_poland),
    sizeBand: r.size_band,
    sizeBasis: r.size_basis,
    prioritySignals: r.priority_signals,
    notes: r.notes ?? null,
    researchedBy: r.researched_by,
    universeResearchedAt: r.researched_at.slice(0, 10),
    websiteCheck: r.website_check
      ? { status: r.website_check.status, finalUrl: r.website_check.final_url, checkedAt: r.website_check.checked_at }
      : null,
  };
  const [existing] = await db()
    .select({ id: companies.id })
    .from(companies)
    .where(sql`${companies.slug} = ${r.id} or ${companies.domain} = ${r.domain}`)
    .limit(1);
  let id: string;
  let action: "created" | "updated";
  if (existing) {
    await db()
      .update(companies)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(companies.id, existing.id));
    id = existing.id;
    action = "updated";
  } else {
    const [row] = await db()
      .insert(companies)
      .values({ ...values, origin })
      .returning({ id: companies.id });
    id = row!.id;
    action = "created";
  }
  for (const s of r.sources) {
    await db()
      .insert(companySources)
      .values({ companyId: id, url: s.url, title: s.title ?? null, usedFor: s.used_for, accessedAt: r.researched_at.slice(0, 10) })
      .onConflictDoUpdate({
        target: [companySources.companyId, companySources.url],
        set: { title: s.title ?? null, usedFor: s.used_for },
      });
  }
  return { id, action };
}

/** Link parent companies by name once all records are imported. */
export async function linkParents(): Promise<number> {
  const res = await db().execute(sql`
    update companies c set parent_company_id = p.id
    from companies p
    where c.parent_name is not null and c.parent_company_id is null and p.id <> c.id
      and (lower(p.name) = lower(c.parent_name) or lower(coalesce(p.brand,'')) = lower(c.parent_name))
  `);
  return (res as unknown as { count?: number }).count ?? 0;
}

export type Coverage = {
  total: number;
  researched: number;
  queued: number;
  withRelevantContact: number;
  withNamedPersonOnly: number;
  withGeneralOnly: number;
  unresolved: number;
  byOutcome: Record<string, number>;
  bySector: { sector: string; total: number; withRelevant: number; researched: number }[];
};

/** "Relevant contact" = person (decision-maker / organiser) or development/HR inbox, with an email that is not invalid/rejected. */
const RELEVANT = sql`(
  ${contacts.roleCategory} in ('decision_maker','organizer_influencer','departmental_inbox')
  and ${contacts.kind} <> 'general_inbox'
  and ${contacts.emailNormalized} is not null
  and ${contacts.emailStatus} <> 'invalid'
  and ${contacts.reviewStatus} <> 'rejected'
  and ${contacts.quality} <> 'blocked'
)`;

export async function coverage(): Promise<Coverage> {
  const rows = await db()
    .select({
      sector: companies.sector,
      status: companies.researchStatus,
      outcome: companies.researchOutcome,
      relevant: sql<number>`count(${contacts.id}) filter (where ${RELEVANT})::int`,
      named: sql<number>`count(${contacts.id}) filter (where ${contacts.kind} = 'person' and ${contacts.roleCategory} in ('decision_maker','organizer_influencer') and ${contacts.reviewStatus} <> 'rejected')::int`,
      general: sql<number>`count(${contacts.id}) filter (where ${contacts.kind} = 'general_inbox' and ${contacts.reviewStatus} <> 'rejected')::int`,
    })
    .from(companies)
    .leftJoin(contacts, eq(contacts.companyId, companies.id))
    .where(and(eq(companies.excluded, false), eq(companies.isDemo, false)))
    .groupBy(companies.id);
  const c: Coverage = {
    total: rows.length,
    researched: 0,
    queued: 0,
    withRelevantContact: 0,
    withNamedPersonOnly: 0,
    withGeneralOnly: 0,
    unresolved: 0,
    byOutcome: {},
    bySector: [],
  };
  const sectors = new Map<string, { total: number; withRelevant: number; researched: number }>();
  for (const r of rows) {
    const s = sectors.get(r.sector) ?? { total: 0, withRelevant: 0, researched: 0 };
    s.total++;
    if (r.status === "queued") c.queued++;
    else {
      c.researched++;
      s.researched++;
    }
    if (r.relevant > 0) {
      c.withRelevantContact++;
      s.withRelevant++;
    } else if (r.named > 0) c.withNamedPersonOnly++;
    else if (r.general > 0) c.withGeneralOnly++;
    if (r.relevant === 0 && r.status !== "queued") c.unresolved++;
    const key = r.outcome ?? (r.status === "queued" ? "queued" : "research_incomplete");
    c.byOutcome[key] = (c.byOutcome[key] ?? 0) + 1;
    sectors.set(r.sector, s);
  }
  c.bySector = [...sectors.entries()].map(([sector, v]) => ({ sector, ...v })).sort((a, b) => b.total - a.total);
  return c;
}

/** Research outcome derived from the contacts we hold for a company. */
export async function deriveCompanyOutcome(companyId: string): Promise<CompanyRow["researchOutcome"]> {
  const rows = await db()
    .select({
      kind: contacts.kind,
      role: contacts.roleCategory,
      email: contacts.emailNormalized,
      emailStatus: contacts.emailStatus,
      review: contacts.reviewStatus,
      dept: contacts.departmentLabel,
    })
    .from(contacts)
    .where(eq(contacts.companyId, companyId));
  const live = rows.filter((r) => r.review !== "rejected");
  const relevantPerson = live.some(
    (r) => r.kind === "person" && (r.role === "decision_maker" || r.role === "organizer_influencer") && r.email && r.emailStatus !== "invalid",
  );
  const devInbox = live.some((r) => r.kind === "department_inbox" && r.role === "departmental_inbox" && r.email && r.emailStatus !== "invalid");
  if (relevantPerson || devInbox) return "relevant_contact_found";
  if (live.some((r) => r.kind === "person" && (r.role === "decision_maker" || r.role === "organizer_influencer") && !r.email)) {
    return "person_found_email_unavailable";
  }
  if (live.some((r) => r.kind === "department_inbox")) return "department_found_no_named_contact";
  if (live.some((r) => r.kind === "general_inbox")) return "general_contact_only";
  return null;
}
