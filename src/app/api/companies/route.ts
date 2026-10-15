import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { registrableDomain, slugify } from "@/lib/normalize";
import { db } from "@/server/db/client";
import { companies, contacts } from "@/server/db/schema";
import { api, badRequest, parseBody, searchParams } from "@/server/http";
import { coverage } from "@/server/services/companies";

export const GET = api(async (req) => {
  const sp = searchParams(req);
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const status = sp.get("status");
  const sector = sp.get("sector");
  const limit = Math.min(Number(sp.get("limit") ?? 500), 1000);
  const conds = [eq(companies.isDemo, false)];
  if (q)
    conds.push(
      sql`(lower(${companies.name}) like ${`%${q}%`} or lower(coalesce(${companies.brand},'')) like ${`%${q}%`} or ${companies.domain} like ${`%${q}%`})`,
    );
  if (sector) conds.push(sql`${companies.sector}::text = ${sector}`);
  if (status === "unresolved")
    conds.push(sql`${companies.researchOutcome} is distinct from 'relevant_contact_found'`);
  if (status === "excluded") conds.push(eq(companies.excluded, true));
  else conds.push(eq(companies.excluded, false));
  const rows = await db()
    .select({
      id: companies.id,
      name: companies.name,
      brand: companies.brand,
      domain: companies.domain,
      website: companies.website,
      sector: companies.sector,
      sizeBand: companies.sizeBand,
      sizeBasis: companies.sizeBasis,
      employeesPoland: companies.employeesPoland,
      employeesGlobal: companies.employeesGlobal,
      origin: companies.origin,
      researchStatus: companies.researchStatus,
      researchOutcome: companies.researchOutcome,
      lastResearchedAt: companies.lastResearchedAt,
      nextResearchAt: companies.nextResearchAt,
      prioritySignals: companies.prioritySignals,
      excluded: companies.excluded,
      contacts: sql<number>`count(${contacts.id}) filter (where ${contacts.reviewStatus} <> 'rejected')::int`,
      relevant: sql<number>`count(${contacts.id}) filter (where ${contacts.reviewStatus} <> 'rejected' and ${contacts.kind} <> 'general_inbox' and ${contacts.roleCategory} in ('decision_maker','organizer_influencer','departmental_inbox') and ${contacts.emailNormalized} is not null and ${contacts.emailStatus} <> 'invalid')::int`,
    })
    .from(companies)
    .leftJoin(contacts, eq(contacts.companyId, companies.id))
    .where(and(...conds))
    .groupBy(companies.id)
    .orderBy(asc(companies.name))
    .limit(limit);
  const cov = sp.get("coverage") === "1" ? await coverage() : null;
  return {
    rows: rows.map((r) => ({
      ...r,
      lastResearchedAt: r.lastResearchedAt?.toISOString() ?? null,
      nextResearchAt: r.nextResearchAt?.toISOString() ?? null,
    })),
    coverage: cov,
  };
});

const NewCompany = z.object({
  name: z.string().trim().min(2).max(200),
  website: z.string().url(),
  sector: z.enum([
    "technology",
    "telecom_media",
    "financial_services",
    "business_services",
    "professional_services",
    "pharma_healthcare",
    "manufacturing_industrial",
    "energy_utilities",
    "logistics_transport",
    "retail_consumer",
    "other",
  ]),
  note: z.string().max(1000).optional(),
});

export const POST = api(async (req) => {
  const b = await parseBody(req, NewCompany);
  const domain = registrableDomain(b.website);
  if (!domain) throw badRequest("Nieprawidłowa strona WWW");
  const [row] = await db()
    .insert(companies)
    .values({
      slug: slugify(`${b.name}-${domain}`),
      name: b.name,
      website: b.website,
      domain,
      sector: b.sector,
      origin: "manual",
      notes: b.note ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: companies.id });
  if (!row) throw badRequest("Firma z tą domeną już istnieje.");
  return { id: row.id };
});
