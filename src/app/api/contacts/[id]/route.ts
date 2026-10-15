import { eq } from "drizzle-orm";
import { z } from "zod";
import { classifyMailbox, normalizeEmail } from "@/lib/normalize";
import { functionFor } from "@/lib/roles";
import { db } from "@/server/db/client";
import { contacts } from "@/server/db/schema";
import { api, badRequest, notFound, parseBody } from "@/server/http";
import { getContactDetail } from "@/server/services/contact-detail";
import { recordContactEvent, refreshDerived } from "@/server/services/contacts";
import { eraseContact } from "@/server/services/privacy";

export const GET = api<{ id: string }>(async (_req, { params }) => {
  const d = await getContactDetail(params.id);
  if (!d) throw notFound("Kontakt nie istnieje");
  return d;
});

const Patch = z.object({
  title: z.string().max(300).nullable().optional(),
  fullName: z.string().max(200).nullable().optional(),
  departmentLabel: z.string().max(200).nullable().optional(),
  email: z.string().max(254).nullable().optional(),
  roleCategory: z
    .enum(["decision_maker", "organizer_influencer", "departmental_inbox", "general_routing", "uncertain"])
    .optional(),
  roleFunction: z
    .enum([
      "hr",
      "learning",
      "procurement",
      "business_leadership",
      "transformation",
      "people_culture",
      "other",
    ])
    .optional(),
  reviewStatus: z.enum(["new", "accepted", "rejected"]).optional(),
  rejectedReason: z.string().max(500).nullable().optional(),
  employmentStatus: z
    .enum(["confirmed_recent", "dated_evidence", "unverified", "possibly_left", "left"])
    .optional(),
  followUpAt: z.string().datetime().nullable().optional(),
});

export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const b = await parseBody(req, Patch);
  const [c] = await db().select().from(contacts).where(eq(contacts.id, params.id)).limit(1);
  if (!c) throw notFound();
  const set: Partial<typeof contacts.$inferInsert> = { updatedAt: new Date() };
  if (b.title !== undefined) set.title = b.title;
  if (b.fullName !== undefined) set.fullName = b.fullName;
  if (b.departmentLabel !== undefined) set.departmentLabel = b.departmentLabel;
  if (b.roleCategory) set.roleCategory = b.roleCategory;
  if (b.roleFunction) set.roleFunction = b.roleFunction;
  else if (b.title !== undefined || b.departmentLabel !== undefined) {
    const fn = functionFor(
      b.title ?? c.title,
      b.departmentLabel ?? c.departmentLabel,
      c.emailNormalized ? classifyMailbox(c.emailNormalized) : null,
    );
    if (fn !== "other") set.roleFunction = fn;
  }
  if (b.employmentStatus) {
    set.employmentStatus = b.employmentStatus;
    set.employmentCheckedAt = new Date();
  }
  if (b.followUpAt !== undefined) set.followUpAt = b.followUpAt ? new Date(b.followUpAt) : null;
  if (b.email !== undefined) {
    const n = b.email ? normalizeEmail(b.email) : null;
    if (b.email && !n) throw badRequest("Nieprawidłowy adres e-mail");
    set.email = b.email?.trim() || null;
    set.emailNormalized = n;
    set.emailOrigin = n ? "user_entered" : "none";
    set.emailStatus = "not_checked";
    set.emailCheckedAt = null;
  }
  if (b.reviewStatus) {
    set.reviewStatus = b.reviewStatus;
    set.reviewedAt = new Date();
    set.rejectedReason = b.reviewStatus === "rejected" ? (b.rejectedReason ?? null) : null;
  }
  await db().update(contacts).set(set).where(eq(contacts.id, params.id));
  await recordContactEvent(params.id, "edited", { fields: Object.keys(b) });
  // Exclusion memory: a rejected row stays in the database, so discovery and import skip it
  // (see upsertContact). It is not a send suppression: re-accepting the contact is allowed.
  await refreshDerived([params.id]);
  return getContactDetail(params.id);
});

/** Erasure: removes the contact and its records; a hashed fingerprint stops rediscovery. */
export const DELETE = api<{ id: string }>(async (_req, { params }) => {
  const n = await eraseContact(params.id);
  if (!n) throw notFound();
  return { ok: true };
});
