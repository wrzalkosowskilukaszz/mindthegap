import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { setTenderStatus, tenderDetail } from "@/server/tenders/service";

export const maxDuration = 30;

export const GET = api<{ id: string }>(async (_req, { params }) => tenderDetail(params.id));

export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(
    req,
    z.object({
      status: z.enum(["new", "saved", "applied", "dismissed"]).optional(),
      note: z.string().max(4000).nullable().optional(),
    }),
  );
  await setTenderStatus(params.id, b);
  return { ok: true };
});
