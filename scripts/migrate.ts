import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, db } from "../src/server/db/client.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
await migrate(db(), { migrationsFolder: path.resolve(import.meta.dirname, "../drizzle") });
console.log("Migrations applied.");
await closeDb();
