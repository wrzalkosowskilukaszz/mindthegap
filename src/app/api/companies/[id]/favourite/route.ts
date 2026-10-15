import { z } from "zod";
import { setFavourite } from "@/server/careers/service";
import { api, parseBody } from "@/server/http";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const { favourite } = await parseBody(req, z.object({ favourite: z.boolean() }));
  await setFavourite(params.id, favourite);
  return { ok: true };
});
