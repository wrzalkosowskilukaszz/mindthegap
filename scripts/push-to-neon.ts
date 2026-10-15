/**
 * Applies migrations to a Neon database over HTTPS and, with --copy, copies the researched data from the
 * local database (DATABASE_URL) into it. For environments where the Postgres port is blocked but HTTPS
 * is not. The target must be empty: nothing is overwritten.
 *
 *   NODE_USE_ENV_PROXY=1 TARGET_DATABASE_URL='postgres://…neon.tech/neondb?sslmode=require' \
 *     node --env-file=.env.local --import tsx scripts/push-to-neon.ts [--copy]
 *
 * Copied: companies and their sources, contacts with evidence and history, programmes and settings
 * (sessions, Gmail tokens, job history and logs are not copied).
 */
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { eq, gt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import type { PgTable } from "drizzle-orm/pg-core";
import { closeDb, db as localDb } from "../src/server/db/client.ts";
import * as schema from "../src/server/db/schema.ts";

const target = process.env.TARGET_DATABASE_URL;
if (!target) {
  console.error("TARGET_DATABASE_URL is not set");
  process.exit(1);
}
const remote = drizzle(neon(target), { schema });

await migrate(remote, { migrationsFolder: path.resolve(import.meta.dirname, "../drizzle") });
console.log("migrations applied");

if (process.argv.includes("--copy")) {
  const counted = (await remote.execute(sql`select count(*)::int as n from companies`)).rows as {
    n: number;
  }[];
  const n = counted[0]?.n ?? 0;
  if (n > 0) {
    console.error(`target already has ${n} companies — nothing copied`);
    process.exit(1);
  }
  // Parent tables first (foreign keys).
  const tables: [string, PgTable][] = [
    ["companies", schema.companies],
    ["company_sources", schema.companySources],
    ["contacts", schema.contacts],
    ["contact_evidence", schema.contactEvidence],
    ["contact_verifications", schema.contactVerifications],
    ["contact_events", schema.contactEvents],
    ["suppressions", schema.suppressions],
    ["programs", schema.programs],
    ["settings", schema.settings],
  ];
  for (const [name, table] of tables) {
    let rows = (await localDb().select().from(table)) as Record<string, unknown>[];
    if (name === "settings") rows = rows.filter((r) => r.key !== "tick_state");
    if (name === "contacts") rows = rows.map((r) => ({ ...r, discoveredByRunId: null }));
    for (let i = 0; i < rows.length; i += 100) {
      // biome-ignore lint/suspicious/noExplicitAny: rows come from the same table definition
      await remote.insert(table).values(rows.slice(i, i + 100) as any);
    }
    console.log(`${name}: ${rows.length}`);
  }
}
// --companies-since=<ISO time>: add companies created locally after that time (e.g. a new research import)
// together with their sources. Existing companies in the target are left untouched.
const since = process.argv.find((a) => a.startsWith("--companies-since="))?.split("=")[1];
if (since) {
  const fresh = await localDb()
    .select()
    .from(schema.companies)
    .where(gt(schema.companies.createdAt, new Date(since)));
  let added = 0;
  for (const co of fresh) {
    const rows = await remote
      .insert(schema.companies)
      .values(co)
      .onConflictDoNothing()
      .returning({ id: schema.companies.id });
    if (!rows.length) continue;
    added++;
    const srcs = await localDb()
      .select()
      .from(schema.companySources)
      .where(eq(schema.companySources.companyId, co.id));
    if (srcs.length) await remote.insert(schema.companySources).values(srcs).onConflictDoNothing();
  }
  console.log(`new companies: ${added} of ${fresh.length}`);
}
await closeDb();
