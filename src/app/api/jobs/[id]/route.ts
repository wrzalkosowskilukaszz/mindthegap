import { z } from "zod";
import { jobDetail, setJobStatus } from "@/server/careers/service";
import { api, parseBody } from "@/server/http";

export const GET = api<{ id: string }>(async (_req, { params }) => jobDetail(params.id));

export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(
    req,
    z.object({
      status: z.enum(["new", "saved", "applied", "dismissed"]).optional(),
      note: z.string().max(4000).nullable().optional(),
    }),
  );
  await setJobStatus(params.id, b);
  return { ok: true };
});
