/**
 * Writes docs/COVERAGE.md from the database: aggregate numbers only (no names, no addresses), so the
 * report can live in the public repository.
 *   node --env-file=.env.local --import tsx scripts/coverage-report.ts [output.md]
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { SECTOR_LABEL } from "../src/lib/contact-query.ts";
import { FUNCTION_LABEL, type RoleFunction } from "../src/lib/roles.ts";
import { closeDb, db } from "../src/server/db/client.ts";

const out = process.argv[2] ?? path.resolve(import.meta.dirname, "../docs/COVERAGE.md");
const rows = async <T>(q: ReturnType<typeof sql>) => (await db().execute(q)) as unknown as T[];

const OUTCOME_LABEL: Record<string, string> = {
  relevant_contact_found: "Relevant contact with an address",
  person_found_email_unavailable: "Relevant person found, no published address",
  department_found_no_named_contact: "Department found, no named person",
  general_contact_only: "General address only (info@, kontakt@)",
  needs_provider_enrichment: "Needs a paid provider",
  no_suitable_contact: "Nothing suitable published",
  source_unavailable: "Website unavailable or blocked by robots.txt",
  research_incomplete: "Research incomplete",
};

const [totals] = await rows<{ companies: number; researched: number; queued: number; excluded: number }>(sql`
  select count(*) filter (where not excluded)::int as companies,
         count(*) filter (where not excluded and last_researched_at is not null)::int as researched,
         count(*) filter (where not excluded and last_researched_at is null)::int as queued,
         count(*) filter (where excluded)::int as excluded
  from companies where not is_demo`);

const outcomes = await rows<{ outcome: string | null; n: number }>(sql`
  select research_outcome::text as outcome, count(*)::int as n from companies
  where not excluded and not is_demo and last_researched_at is not null
  group by 1 order by 2 desc`);

const contactKinds = await rows<{ kind: string; total: number; with_email: number }>(sql`
  select kind::text as kind, count(*)::int as total, count(email_normalized)::int as with_email
  from contacts where not is_demo and review_status <> 'rejected' group by 1 order by 2 desc`);

const byFunction = await rows<{
  fn: RoleFunction;
  people: number;
  people_email: number;
  inboxes: number;
}>(sql`
  select role_function::text as fn,
         count(*) filter (where kind = 'person')::int as people,
         count(*) filter (where kind = 'person' and email_normalized is not null)::int as people_email,
         count(*) filter (where kind = 'department_inbox')::int as inboxes
  from contacts where not is_demo and review_status <> 'rejected' and kind <> 'general_inbox'
  group by 1 order by 2 desc`);

const byRole = await rows<{ role: string; n: number }>(sql`
  select role_category::text as role, count(*)::int as n from contacts
  where not is_demo and review_status <> 'rejected' and kind = 'person' group by 1 order by 2 desc`);

const bySector = await rows<{
  sector: string;
  companies: number;
  researched: number;
  with_relevant: number;
}>(sql`
  select c.sector::text as sector, count(*)::int as companies,
         count(*) filter (where c.last_researched_at is not null)::int as researched,
         count(*) filter (where exists (
           select 1 from contacts k where k.company_id = c.id and k.review_status <> 'rejected'
             and k.email_normalized is not null
             and k.role_category in ('decision_maker','organizer_influencer','departmental_inbox')))::int as with_relevant
  from companies c where not c.excluded and not c.is_demo group by 1 order by 2 desc`);

const [withAnyRelevant] = await rows<{ n: number; people_no_email: number }>(sql`
  select count(distinct company_id) filter (where email_normalized is not null)::int as n,
         count(distinct company_id) filter (where email_normalized is null and kind = 'person')::int as people_no_email
  from contacts where not is_demo and review_status <> 'rejected'
    and role_category in ('decision_maker','organizer_influencer','departmental_inbox')`);

const [runs] = await rows<{ last: string | null }>(sql`select max(finished_at)::text as last from job_runs`);

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const t = totals!;
const md = `# Coverage report

Generated from the database on ${new Date().toISOString().slice(0, 10)} (last discovery run finished ${runs?.last?.slice(0, 16) ?? "–"} UTC) by \`scripts/coverage-report.ts\`. Aggregate numbers only: names and addresses stay in the database.

Sources used: the companies' own public websites (free crawler) and Wikidata for new companies. **No paid provider was configured**, so no email addresses were looked up or verified by Hunter, and the AI-assisted reading was off.

## Companies

| | Count |
|---|---|
| Companies in the universe (not excluded) | ${t.companies} |
| Researched at least once | ${t.researched} (${pct(t.researched, t.companies)}) |
| Still queued | ${t.queued} |
| Excluded | ${t.excluded} |
| With a relevant contact **and an address** | ${withAnyRelevant?.n ?? 0} (${pct(withAnyRelevant?.n ?? 0, t.researched)} of researched) |

### Research outcome per company

| Outcome | Companies |
|---|---|
${outcomes.map((o) => `| ${OUTCOME_LABEL[o.outcome ?? ""] ?? o.outcome ?? "not set"} | ${o.n} |`).join("\n")}

### By sector

| Sector | Companies | Researched | With relevant contact + address |
|---|---|---|---|
${bySector.map((s) => `| ${SECTOR_LABEL[s.sector] ?? s.sector} | ${s.companies} | ${s.researched} | ${s.with_relevant} |`).join("\n")}

## Contacts

| Kind | Total | With an address |
|---|---|---|
${contactKinds.map((k) => `| ${{ person: "Named people", department_inbox: "Department mailboxes", general_inbox: "General addresses (fallback)" }[k.kind] ?? k.kind} | ${k.total} | ${k.with_email} |`).join("\n")}

### By department (people and department mailboxes)

| Department | People | People with address | Department mailboxes |
|---|---|---|---|
${byFunction.map((f) => `| ${f.fn === "other" ? "Not determined" : FUNCTION_LABEL[f.fn]} | ${f.people} | ${f.people_email} | ${f.inboxes} |`).join("\n")}

### Named people by role assessment

| Role | People |
|---|---|
${byRole.map((r) => `| ${{ decision_maker: "Likely decision-maker", organizer_influencer: "Organiser / influencer", departmental_inbox: "Department mailbox", general_routing: "General routing", uncertain: "Uncertain" }[r.role] ?? r.role} | ${r.n} |`).join("\n")}

## What this means

- Public company websites in Poland name senior HR, L&D, procurement and business leaders fairly often, but they **rarely publish their email addresses**. Those people are stored with their source page, marked *Brak adresu*, and are the best use of a paid lookup (Hunter's free plan: 50 credits a month; found-only mode).
- Department mailboxes (HR, training, procurement, supplier channels) are the most common usable result from public pages.
- Companies with only a general address keep that one address as a last-resort route, never more than one per company.
- Unresolved companies get a revisit date; the daily run comes back to them and to newly discovered companies.
- Most "website unavailable" results were HTTP 403 answers from bot protection in the research environment (and some robots.txt rules). Those companies are queued again so the production app retries them from its own network.
`;

writeFileSync(out, md);
console.log(`written ${out}`);
await closeDb();
