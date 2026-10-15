import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db/client";
import { contacts } from "@/server/db/schema";
import { api, badRequest, parseBody } from "@/server/http";
import { addSuppression, recordContactEvent, refreshDerived } from "@/server/services/contacts";

const Body = z.object({
  basis: z.enum(["not_assessed", "consent", "invitation_to_offer", "prior_relationship", "other_documented", "do_not_contact"]),
  evidence: z.string().max(4000).optional().nullable(),
  evidenceUrl: z.string().url().optional().nullable(),
  scope: z.string().max(500).optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

/** Records the owner's documented basis. The app stores evidence; it does not decide legality. */
export const POST = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(req, Body);
  const needsEvidence = ["consent", "invitation_to_offer", "prior_relationship", "other_documented"].includes(b.basis);
  if (needsEvidence && !b.evidence?.trim() && !b.evidenceUrl) throw badRequest("Opisz dowód lub podaj link do niego.");
  if (needsEvidence && !b.date) throw badRequest("Podaj datę (kiedy podstawa powstała).");
  const [c] = await db()
    .update(contacts)
    .set({
      eligibilityBasis: b.basis,
      eligibilityEvidence: b.evidence ?? null,
      eligibilityEvidenceUrl: b.evidenceUrl ?? null,
      eligibilityScope: b.scope ?? null,
      eligibilityDate: b.date ?? null,
      eligibilityRecordedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, params.id))
    .returning();
  if (!c) throw badRequest("Kontakt nie istnieje");
  await recordContactEvent(params.id, "eligibility_set", { basis: b.basis, scope: b.scope ?? null, date: b.date ?? null });
  if (b.basis === "do_not_contact" && c.emailNormalized) await addSuppression("email", c.emailNormalized, "Nie kontaktować", "user");
  await refreshDerived([params.id]);
  return { ok: true };
});
