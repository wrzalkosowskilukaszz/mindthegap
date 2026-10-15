import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { schedule, unschedule } from "@/server/services/messages";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const { at } = await parseBody(req, z.object({ at: z.string().datetime() }));
  const m = await schedule(params.id, new Date(at));
  return { status: m.status, scheduledFor: m.scheduledFor?.toISOString() };
});

export const DELETE = api<{ id: string }>(async (_req, { params }) => {
  const m = await unschedule(params.id);
  return { status: m.status };
});
