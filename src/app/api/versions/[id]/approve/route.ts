import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { approveDocumentVersion } from "@/server/materials/service";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const { approve } = await parseBody(req, z.object({ approve: z.boolean() }));
  await approveDocumentVersion(params.id, approve);
  return { ok: true };
});
