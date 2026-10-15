import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { restoreRevision } from "@/server/services/messages";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const { rev } = await parseBody(req, z.object({ rev: z.number().int().min(1) }));
  await restoreRevision(params.id, rev);
  return { ok: true };
});
