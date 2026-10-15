import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { composerData } from "@/server/services/composer";
import { discard, updateDraft } from "@/server/services/messages";

export const GET = api<{ id: string }>(async (_req, { params }) => composerData(params.id));

export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(
    req,
    z.object({
      subject: z.string().max(300).optional(),
      body: z.string().max(20000).optional(),
      programId: z.string().uuid().nullable().optional(),
      language: z.enum(["pl", "en"]).optional(),
      attachmentVersionIds: z.array(z.string().uuid()).max(5).optional(),
      revision: z.number().int(),
    }),
  );
  const m = await updateDraft(params.id, b);
  return { revision: m.revision, status: m.status, updatedAt: m.updatedAt.toISOString() };
});

export const DELETE = api<{ id: string }>(async (_req, { params }) => {
  await discard(params.id);
  return { ok: true };
});
