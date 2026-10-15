import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { api } from "@/server/http";

/** Public liveness check: reveals nothing but "ok" and whether the database answers. */
export const GET = api(
  async () => {
    try {
      await db().execute(sql`select 1`);
      return { ok: true, db: true };
    } catch {
      return new Response(JSON.stringify({ ok: false, db: false }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
  },
  { public: true },
);
