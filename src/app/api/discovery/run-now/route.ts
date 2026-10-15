import { api } from "@/server/http";
import { createManualRun } from "@/server/jobs/runs";

/** Creates (or reuses) a run. The page then drives short work slices; the scheduler finishes the rest. */
export const POST = api(async () => {
  const { run, reused } = await createManualRun();
  return { runId: run.id, reused };
});
