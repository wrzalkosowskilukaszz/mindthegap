import { z } from "zod";
import { saveTailoredCv, tailoredCv } from "@/server/careers/service";
import { api, parseBody } from "@/server/http";

export const GET = api<{ id: string }>(async (_req, { params }) => tailoredCv(params.id));

export const PUT = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(req, z.object({ text: z.string().max(30_000) }));
  return saveTailoredCv(params.id, b.text);
});
