import { z } from "zod";
import { eventDetail, setEventStatus } from "@/server/events/service";
import { api, parseBody } from "@/server/http";

export const GET = api<{ id: string }>(async (_req, { params }) => eventDetail(params.id));

export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(
    req,
    z.object({
      status: z.enum(["new", "saved", "going", "dismissed"]).optional(),
      note: z.string().max(4000).nullable().optional(),
    }),
  );
  await setEventStatus(params.id, b);
  return { ok: true };
});
