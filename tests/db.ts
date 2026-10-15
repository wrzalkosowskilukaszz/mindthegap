import path from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../src/server/db/client.ts";

export const hasDb = Boolean(process.env.TEST_DATABASE_URL);

let migrated = false;
export async function resetDb() {
  if (!migrated) {
    await db().execute(sql`drop schema if exists public cascade; create schema public;`);
    await db().execute(sql`drop schema if exists drizzle cascade;`);
    await migrate(db(), { migrationsFolder: path.resolve(import.meta.dirname, "../drizzle") });
    migrated = true;
  }
  const tables = await db().execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  const names = (tables as unknown as { tablename: string }[]).map((t) => `"${t.tablename}"`).join(", ");
  if (names) await db().execute(sql.raw(`truncate ${names} restart identity cascade`));
}
