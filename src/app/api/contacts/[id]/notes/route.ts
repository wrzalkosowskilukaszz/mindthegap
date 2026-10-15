import { z } from "zod";
import { db } from "@/server/db/client";
import { notes } from "@/server/db/schema";
import { api, parseBody } from "@/server/http";

export const POST = api<{ id: string }>(async (req, { params }) => {
  const { body } = await parseBody(req, z.object({ body: z.string().trim().min(1).max(5000) }));
  const [n] = await db().insert(notes).values({ contactId: params.id, body }).returning();
  return { id: n!.id, body: n!.body, createdAt: n!.createdAt.toISOString() };
});
