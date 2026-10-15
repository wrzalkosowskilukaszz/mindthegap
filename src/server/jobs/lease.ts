/**
 * Leases prevent overlapping equivalent jobs across processes and hosts (works with pooled/serverless
 * connections, unlike session-level advisory locks). A crashed holder's lease simply expires.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { leases } from "../db/schema.ts";

export async function acquireLease(name: string, holder: string, ttlMs: number): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const rows = await db()
    .insert(leases)
    .values({ name, holder, expiresAt })
    .onConflictDoUpdate({
      target: leases.name,
      set: { holder, expiresAt },
      setWhere: sql`${leases.expiresAt} < now() or ${leases.holder} = ${holder}`,
    })
    .returning({ holder: leases.holder });
  return rows.length > 0 && rows[0]!.holder === holder;
}

export async function renewLease(name: string, holder: string, ttlMs: number): Promise<boolean> {
  const rows = await db()
    .update(leases)
    .set({ expiresAt: new Date(Date.now() + ttlMs) })
    .where(and(eq(leases.name, name), eq(leases.holder, holder)))
    .returning({ name: leases.name });
  return rows.length > 0;
}

export async function releaseLease(name: string, holder: string): Promise<void> {
  await db()
    .delete(leases)
    .where(and(eq(leases.name, name), eq(leases.holder, holder)));
}
