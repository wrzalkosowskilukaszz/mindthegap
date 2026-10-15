import { asc } from "drizzle-orm";
import { z } from "zod";
import { ContactQuery } from "@/lib/contact-query";
import { db } from "@/server/db/client";
import { savedViews } from "@/server/db/schema";
import { api, parseBody } from "@/server/http";

export const GET = api(async () => {
  const rows = await db().select().from(savedViews).orderBy(asc(savedViews.position), asc(savedViews.createdAt));
  return { views: rows.map((v) => ({ id: v.id, name: v.name, query: v.query })) };
});

export const POST = api(async (req) => {
  const b = await parseBody(req, z.object({ name: z.string().trim().min(1).max(60), query: ContactQuery }));
  const { offset: _o, limit: _l, view: _v, ...query } = b.query;
  const [row] = await db().insert(savedViews).values({ name: b.name, query }).returning();
  return { id: row!.id, name: row!.name, query: row!.query };
});
