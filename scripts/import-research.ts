/**
 * Import research/companies/universe.jsonl into the database (idempotent upsert by slug/domain).
 * Usage: DATABASE_URL=... node --import tsx scripts/import-research.ts [path]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { closeDb } from "../src/server/db/client.ts";
import { CompanyRecord } from "../src/lib/research/company-record.ts";
import { linkParents, upsertCompanyFromRecord } from "../src/server/services/companies.ts";

const file = process.argv[2] ?? path.resolve(import.meta.dirname, "../research/companies/universe.jsonl");
const lines = readFileSync(file, "utf8").split("\n").filter((l) => l.trim());
let created = 0;
let updated = 0;
let invalid = 0;
for (const line of lines) {
  const parsed = CompanyRecord.safeParse(JSON.parse(line));
  if (!parsed.success) {
    invalid++;
    continue;
  }
  const r = await upsertCompanyFromRecord(parsed.data, "initial_universe");
  if (r.action === "created") created++;
  else updated++;
}
const linked = await linkParents();
console.log(`companies: created=${created} updated=${updated} invalid=${invalid} parentsLinked=${linked}`);
await closeDb();
