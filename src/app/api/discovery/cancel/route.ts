import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { cancelRun } from "@/server/jobs/runs";

export const POST = api(async (req) => {
  const { runId } = await parseBody(req, z.object({ runId: z.string().uuid() }));
  await cancelRun(runId);
  return { ok: true };
});
