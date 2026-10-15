import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { contacts } from "@/server/db/schema";
import { api, parseBody } from "@/server/http";
import { recordContactEvent, refreshDerived } from "@/server/services/contacts";

const Body = z.object({
  action: z.enum(["accept", "reject", "dnc"]),
  ids: z.array(z.string().uuid()).min(1).max(1000),
  reason: z.string().max(300).optional(),
});

export const POST = api(async (req) => {
  const b = await parseBody(req, Body);
  const now = new Date();
  if (b.action === "accept" || b.action === "reject") {
    await db()
      .update(contacts)
      .set({
        reviewStatus: b.action === "accept" ? "accepted" : "rejected",
        reviewedAt: now,
        rejectedReason: b.action === "reject" ? (b.reason ?? null) : null,
        updatedAt: now,
      })
      .where(inArray(contacts.id, b.ids));
  } else {
    await db()
      .update(contacts)
      .set({
        eligibilityBasis: "do_not_contact",
        eligibilityRecordedAt: now,
        eligibilityDate: now.toISOString().slice(0, 10),
        updatedAt: now,
      })
      .where(inArray(contacts.id, b.ids));
  }
  for (const id of b.ids) await recordContactEvent(id, `bulk_${b.action}`, {});
  await refreshDerived(b.ids);
  return { updated: b.ids.length };
});

export const dynamic = "force-dynamic";
