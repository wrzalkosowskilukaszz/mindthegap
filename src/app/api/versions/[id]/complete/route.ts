import { api } from "@/server/http";
import { completeVersion } from "@/server/materials/service";

export const maxDuration = 120;

export const POST = api<{ id: string }>(async (_req, { params }) => {
  const v = await completeVersion(params.id);
  return { id: v.id, extractionStatus: v.extractionStatus, extractionError: v.extractionError };
});
