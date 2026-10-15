import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { companies } from "@/server/db/schema";
import { api, notFound, parseBody } from "@/server/http";

const Patch = z.object({
  excluded: z.boolean().optional(),
  excludedReason: z.string().max(500).nullable().optional(),
  researchNow: z.boolean().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(req, Patch);
  const set: Partial<typeof companies.$inferInsert> = { updatedAt: new Date() };
  if (b.excluded !== undefined) {
    // Exclusion memory: discovery never researches or resurfaces excluded companies.
    set.excluded = b.excluded;
    set.excludedReason = b.excluded ? (b.excludedReason ?? null) : null;
    set.researchStatus = b.excluded ? "excluded" : "needs_more_work";
  }
  if (b.researchNow) set.nextResearchAt = new Date(0);
  if (b.notes !== undefined) set.notes = b.notes;
  const [row] = await db().update(companies).set(set).where(eq(companies.id, params.id)).returning({ id: companies.id });
  if (!row) throw notFound();
  return { ok: true };
});
