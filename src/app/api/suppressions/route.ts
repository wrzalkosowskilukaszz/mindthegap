import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { suppressions } from "@/server/db/schema";
import { api, parseBody } from "@/server/http";
import { addSuppression } from "@/server/services/contacts";

export const GET = api(async () => ({
  rows: await db().select().from(suppressions).orderBy(desc(suppressions.createdAt)).limit(2000),
}));

export const POST = api(async (req) => {
  const b = await parseBody(
    req,
    z.object({
      kind: z.enum(["email", "domain"]),
      value: z.string().trim().min(3).max(254),
      reason: z.string().max(300).default(""),
    }),
  );
  await addSuppression(b.kind, b.value, b.reason || "Dodane ręcznie");
  return { ok: true };
});
