import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { reclassify } from "@/server/gmail/sync";

export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const { classification } = await parseBody(req, z.object({ classification: z.enum(["human_reply", "auto_reply", "bounce", "unknown"]) }));
  await reclassify(params.id, classification);
  return { ok: true };
});
