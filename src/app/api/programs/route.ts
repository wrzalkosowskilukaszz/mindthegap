import { z } from "zod";
import { db } from "@/server/db/client";
import { programs } from "@/server/db/schema";
import { api, parseBody } from "@/server/http";

export const POST = api(async (req) => {
  const { name } = await parseBody(req, z.object({ name: z.string().trim().min(2).max(160) }));
  const [p] = await db().insert(programs).values({ name, summarySource: "manual" }).returning();
  return { id: p!.id };
});
