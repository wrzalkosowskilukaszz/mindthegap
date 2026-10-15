import { z } from "zod";
import { api, parseBody } from "@/server/http";
import { createDocument } from "@/server/materials/service";

export const POST = api(async (req) => {
  const b = await parseBody(req, z.object({ title: z.string().trim().min(1).max(200), usage: z.enum(["internal", "quotable", "attachment"]), programId: z.string().uuid().nullable() }));
  const d = await createDocument(b);
  return { id: d.id };
});
