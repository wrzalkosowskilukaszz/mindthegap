import { z } from "zod";
import { db } from "@/server/db/client";
import { batches } from "@/server/db/schema";
import { api, HttpError, parseBody } from "@/server/http";
import { createDraft } from "@/server/services/messages";

/** Bulk preparation creates one individual draft per contact (never one shared message). */
export const POST = api(async (req) => {
  const b = await parseBody(req, z.object({ contactIds: z.array(z.string().uuid()).min(1).max(100), programId: z.string().uuid().nullable(), language: z.enum(["pl", "en"]) }));
  const [batch] = await db().insert(batches).values({ name: `Partia ${new Date().toISOString().slice(0, 16).replace("T", " ")}`, programId: b.programId, language: b.language }).returning();
  const created: { contactId: string; messageId: string }[] = [];
  const skipped: { contactId: string; reason: string }[] = [];
  for (const contactId of b.contactIds) {
    try {
      const m = await createDraft({ contactId, programId: b.programId, language: b.language, batchId: batch!.id });
      created.push({ contactId, messageId: m.id });
    } catch (e) {
      skipped.push({ contactId, reason: e instanceof HttpError || e instanceof Error ? e.message : String(e) });
    }
  }
  return { batchId: batch!.id, created, skipped };
});
