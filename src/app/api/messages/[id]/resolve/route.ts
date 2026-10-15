import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { resolveUncertain } from "@/server/gmail/dispatch";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const { wasSent } = await parseBody(req, z.object({ wasSent: z.boolean() }));
  await resolveUncertain(params.id, wasSent);
  return { ok: true };
});
