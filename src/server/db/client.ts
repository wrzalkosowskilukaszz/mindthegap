import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.ts";
import * as schema from "./schema.ts";

export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __mtgSql?: postgres.Sql; __mtgDb?: Db };

export function sqlClient(): postgres.Sql {
  if (!globalForDb.__mtgSql) {
    globalForDb.__mtgSql = postgres(env().DATABASE_URL, {
      max: Number(process.env.DB_POOL_MAX ?? 5),
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
      onnotice: () => {},
    });
  }
  return globalForDb.__mtgSql;
}

export function db(): Db {
  if (!globalForDb.__mtgDb) {
    globalForDb.__mtgDb = drizzle(sqlClient(), { schema });
  }
  return globalForDb.__mtgDb;
}

export async function closeDb(): Promise<void> {
  if (globalForDb.__mtgSql) {
    await globalForDb.__mtgSql.end({ timeout: 5 });
    globalForDb.__mtgSql = undefined;
    globalForDb.__mtgDb = undefined;
  }
}

export { schema };
