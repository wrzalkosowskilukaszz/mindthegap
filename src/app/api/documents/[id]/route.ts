import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { documents } from "@/server/db/schema";
import { api, parseBody } from "@/server/http";

export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(req, z.object({ title: z.string().trim().min(1).max(200).optional(), usage: z.enum(["internal", "quotable", "attachment"]).optional(), programId: z.string().uuid().nullable().optional() }));
  // Changing how a document may be used requires a fresh approval.
  const set: Partial<typeof documents.$inferInsert> = { ...b, updatedAt: new Date() };
  if (b.usage) set.approvedAt = null;
  await db().update(documents).set(set).where(eq(documents.id, params.id));
  return { ok: true };
});

export const DELETE = api<{ id: string }>(async (_req, { params }) => {
  await db().delete(documents).where(eq(documents.id, params.id));
  return { ok: true };
});
