/** SQL for the Kontakty table: filters, search, sorting, pagination, CSV export rows. */
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, type SQL, sql } from "drizzle-orm";
import { BUILTIN_VIEWS, type ContactQuery } from "@/lib/contact-query";
import { db } from "../db/client.ts";
import { companies, contacts, jobRuns } from "../db/schema.ts";

const fold = (col: SQL | unknown) => sql`translate(lower(coalesce(${col}, '')), 'ąćęłńóśźżäöüé', 'acelnoszzaoue')`;

export function resolveQuery(q: ContactQuery): ContactQuery {
  const view = q.view ? BUILTIN_VIEWS.find((v) => v.id === q.view) : undefined;
  if (!view) return q;
  // Explicit params override the view's defaults.
  const merged: ContactQuery = { ...view.query };
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
  }
  return merged;
}

async function latestRunId(): Promise<string | null> {
  const [r] = await db()
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(eq(jobRuns.kind, "discovery"))
    .orderBy(desc(jobRuns.createdAt))
    .limit(1);
  return r?.id ?? null;
}

export async function buildWhere(qIn: ContactQuery): Promise<SQL | undefined> {
  const q = resolveQuery(qIn);
  const conds: SQL[] = [eq(contacts.isDemo, false)];
  if (q.q?.trim()) {
    const needle = `%${q.q
      .trim()
      .toLowerCase()
      .replace(/[ąćęłńóśźżäöüé]/g, (c) => ({ ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z", ä: "a", ö: "o", ü: "u", é: "e" })[c] ?? c)
      .replace(/[%_]/g, "\\$&")}%`;
    conds.push(
      or(
        sql`${fold(contacts.fullName)} like ${needle}`,
        sql`${fold(contacts.emailNormalized)} like ${needle}`,
        sql`${fold(contacts.title)} like ${needle}`,
        sql`${fold(contacts.departmentLabel)} like ${needle}`,
        sql`${fold(companies.name)} like ${needle}`,
        sql`${fold(companies.brand)} like ${needle}`,
        sql`${fold(companies.domain)} like ${needle}`,
      )!,
    );
  }
  if (q.companyId) conds.push(eq(contacts.companyId, q.companyId));
  if (q.sector?.length) conds.push(sql`${companies.sector}::text in ${q.sector}`);
  if (q.size?.length) conds.push(inArray(companies.sizeBand, q.size));
  if (q.role?.length) conds.push(inArray(contacts.roleCategory, q.role));
  if (q.kind?.length) conds.push(inArray(contacts.kind, q.kind));
  if (q.quality?.length) conds.push(inArray(contacts.quality, q.quality));
  if (q.email?.length) conds.push(inArray(contacts.emailStatus, q.email));
  if (q.outreach?.length) conds.push(inArray(contacts.outreachStatus, q.outreach));
  if (q.review?.length) conds.push(inArray(contacts.reviewStatus, q.review));
  if (q.verifiedOlderThan) {
    conds.push(
      or(isNull(contacts.emailCheckedAt), sql`${contacts.emailCheckedAt} < now() - make_interval(days => ${q.verifiedOlderThan})`)!,
    );
    conds.push(isNotNull(contacts.emailNormalized));
  }
  if (q.verifiedWithin) conds.push(sql`${contacts.emailCheckedAt} >= now() - make_interval(days => ${q.verifiedWithin})`);
  const fallbackSql = sql`(${contacts.kind} = 'general_inbox' or ${contacts.roleCategory} = 'general_routing')`;
  if (q.fallback === "only") conds.push(fallbackSql);
  else if (q.fallback !== "include") conds.push(sql`not ${fallbackSql}`);
  if (q.runId) conds.push(eq(contacts.discoveredByRunId, q.runId));
  else if (q.latestRun) {
    const id = await latestRunId();
    conds.push(id ? eq(contacts.discoveredByRunId, id) : sql`false`);
  }
  return and(...conds);
}

function orderBy(q: ContactQuery): SQL[] {
  const dir = q.dir === "desc" ? desc : asc;
  const nameExpr = sql`coalesce(${contacts.fullName}, ${contacts.departmentLabel}, ${contacts.emailNormalized})`;
  const roleOrder = sql`case ${contacts.roleCategory} when 'decision_maker' then 0 when 'organizer_influencer' then 1 when 'departmental_inbox' then 2 when 'uncertain' then 3 else 4 end`;
  const qualityOrder = sql`case ${contacts.quality} when 'ready' then 0 when 'caution' then 1 when 'needs_research' then 2 else 3 end`;
  switch (q.sort) {
    case "name":
      return [dir(nameExpr), asc(contacts.id)];
    case "role":
      return [dir(roleOrder), asc(companies.name), asc(contacts.id)];
    case "verification":
      return [q.dir === "desc" ? sql`${contacts.emailCheckedAt} desc nulls last` : sql`${contacts.emailCheckedAt} asc nulls first`, asc(contacts.id)];
    case "last_contact":
      return [q.dir === "asc" ? sql`${contacts.lastContactedAt} asc nulls last` : sql`${contacts.lastContactedAt} desc nulls last`, asc(contacts.id)];
    case "reply":
      return [q.dir === "asc" ? sql`${contacts.lastReplyAt} asc nulls last` : sql`${contacts.lastReplyAt} desc nulls last`, asc(contacts.id)];
    case "discovered":
      return [q.dir === "asc" ? asc(contacts.discoveredAt) : desc(contacts.discoveredAt), asc(contacts.id)];
    case "quality":
      return [dir(qualityOrder), asc(roleOrder), asc(companies.name), asc(contacts.id)];
    default:
      return [dir(companies.name), asc(roleOrder), asc(contacts.id)];
  }
}

export const listColumns = {
  id: contacts.id,
  kind: contacts.kind,
  fullName: contacts.fullName,
  departmentLabel: contacts.departmentLabel,
  title: contacts.title,
  roleCategory: contacts.roleCategory,
  email: contacts.email,
  emailStatus: contacts.emailStatus,
  emailOrigin: contacts.emailOrigin,
  emailCheckedAt: contacts.emailCheckedAt,
  quality: contacts.quality,
  qualityReasons: contacts.qualityReasons,
  outreachStatus: contacts.outreachStatus,
  lastContactedAt: contacts.lastContactedAt,
  lastReplyAt: contacts.lastReplyAt,
  followUpAt: contacts.followUpAt,
  reviewStatus: contacts.reviewStatus,
  discoveredAt: contacts.discoveredAt,
  eligibilityBasis: contacts.eligibilityBasis,
  employmentStatus: contacts.employmentStatus,
  companyId: companies.id,
  companyName: companies.name,
  companyBrand: companies.brand,
  companySector: companies.sector,
  companySize: companies.sizeBand,
  companyDomain: companies.domain,
};

export async function listContacts(qIn: ContactQuery) {
  const q = resolveQuery(qIn);
  const where = await buildWhere(qIn);
  const limit = q.limit ?? 100;
  const offset = q.offset ?? 0;
  const rows = await db()
    .select(listColumns)
    .from(contacts)
    .innerJoin(companies, eq(contacts.companyId, companies.id))
    .where(where)
    .orderBy(...orderBy(q))
    .limit(limit)
    .offset(offset);
  const [{ total } = { total: 0 }] = await db()
    .select({ total: sql<number>`count(*)::int` })
    .from(contacts)
    .innerJoin(companies, eq(contacts.companyId, companies.id))
    .where(where);
  return {
    rows: rows.map((r) => ({
      ...r,
      emailCheckedAt: r.emailCheckedAt?.toISOString() ?? null,
      lastContactedAt: r.lastContactedAt?.toISOString() ?? null,
      lastReplyAt: r.lastReplyAt?.toISOString() ?? null,
      followUpAt: r.followUpAt?.toISOString() ?? null,
      discoveredAt: r.discoveredAt.toISOString(),
    })),
    total,
    offset,
    limit,
  };
}

export type ContactListRow = Awaited<ReturnType<typeof listContacts>>["rows"][number];

export async function viewCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const v of BUILTIN_VIEWS) {
    const where = await buildWhere({ view: v.id });
    const [{ n } = { n: 0 }] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(contacts)
      .innerJoin(companies, eq(contacts.companyId, companies.id))
      .where(where);
    out[v.id] = n;
  }
  return out;
}
