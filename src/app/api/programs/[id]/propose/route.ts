import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { proposeSummary } from "@/server/materials/service";

export const maxDuration = 300;

export const POST = api<{ id: string }>(async (req, { params }) => {
  const { versionIds } = await parseBody(req, z.object({ versionIds: z.array(z.string().uuid()).min(1).max(5) }));
  return proposeSummary(params.id, versionIds);
});
