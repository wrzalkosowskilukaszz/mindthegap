import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { lintForMessage } from "@/server/services/composer";
import { approve, getMessage } from "@/server/services/messages";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const { acknowledgeWarnings } = await parseBody(req, z.object({ acknowledgeWarnings: z.boolean().default(false) }));
  const m = await getMessage(params.id);
  const lint = await lintForMessage(m);
  const u = await approve(params.id, { acknowledgeWarnings, lint });
  return { status: u.status, approval: u.approval };
});
