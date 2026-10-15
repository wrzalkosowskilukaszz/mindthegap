import { z } from "zod";
import { markSentManually } from "@/server/gmail/dispatch";
import { api, parseBody } from "@/server/http";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const { sentAt } = await parseBody(req, z.object({ sentAt: z.string().datetime().optional() }));
  await markSentManually(params.id, sentAt ? new Date(sentAt) : new Date());
  return { ok: true };
});
