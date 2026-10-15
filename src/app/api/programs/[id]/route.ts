import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { programs } from "@/server/db/schema";
import { api, badRequest, notFound, parseBody } from "@/server/http";
import { isSendableAttachment } from "@/server/services/messages";

const FieldSchema = z.object({ value: z.string().max(1000), quote: z.string().max(2000).nullable().optional(), quoteVerified: z.boolean().optional() });
const Summary = z.object({
  audience: FieldSchema.optional(),
  problem: FieldSchema.optional(),
  outcomes: z.array(FieldSchema).max(12).optional(),
  keyPoints: z.array(FieldSchema).max(12).optional(),
  format: FieldSchema.optional(),
  duration: FieldSchema.optional(),
  language: FieldSchema.optional(),
  pricing: FieldSchema.nullable().optional(),
});

export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(
    req,
    z.object({
      name: z.string().trim().min(2).max(160).optional(),
      summary: Summary.optional(),
      status: z.enum(["draft", "approved", "archived"]).optional(),
      defaultAttachmentVersionId: z.string().uuid().nullable().optional(),
    }),
  );
  const set: Partial<typeof programs.$inferInsert> = { updatedAt: new Date() };
  if (b.name) set.name = b.name;
  if (b.summary) {
    set.summary = b.summary;
    // Editing the summary returns it to review unless it is approved in the same request.
    if (!b.status) {
      set.status = "draft";
      set.approvedAt = null;
    }
  }
  if (b.status) {
    set.status = b.status;
    set.approvedAt = b.status === "approved" ? new Date() : null;
  }
  if (b.defaultAttachmentVersionId !== undefined) {
    if (b.defaultAttachmentVersionId && !(await isSendableAttachment(b.defaultAttachmentVersionId))) throw badRequest("Domyślnym załącznikiem może być tylko zatwierdzony plik typu „załącznik”.");
    set.defaultAttachmentVersionId = b.defaultAttachmentVersionId;
  }
  const [p] = await db().update(programs).set(set).where(eq(programs.id, params.id)).returning({ id: programs.id });
  if (!p) throw notFound();
  return { ok: true };
});

export const DELETE = api<{ id: string }>(async (_req, { params }) => {
  await db().update(programs).set({ status: "archived", updatedAt: new Date() }).where(eq(programs.id, params.id));
  return { ok: true };
});
