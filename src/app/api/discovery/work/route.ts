import { randomUUID } from "node:crypto";
import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { acquireLease, releaseLease } from "@/server/jobs/lease";
import { processRun } from "@/server/jobs/runs";

export const maxDuration = 60;

/** One bounded slice (≈40 s) of a run, while the Odkrywanie page is open. Safe with concurrent ticks (lease). */
export const POST = api(async (req) => {
  const { runId } = await parseBody(req, z.object({ runId: z.string().uuid() }));
  const holder = `ui:${randomUUID().slice(0, 8)}`;
  if (!(await acquireLease("discovery-worker", holder, 90_000))) return { busy: true };
  try {
    return { busy: false, ...(await processRun(runId, Date.now() + 40_000, holder)) };
  } finally {
    await releaseLease("discovery-worker", holder);
  }
});
