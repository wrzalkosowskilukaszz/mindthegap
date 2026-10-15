/** Zod schema for research/companies/*.jsonl records (see research/companies/SCHEMA.md). */
import { z } from "zod";

const SECTOR = z.enum([
  "technology",
  "telecom_media",
  "financial_services",
  "business_services",
  "professional_services",
  "pharma_healthcare",
  "manufacturing_industrial",
  "energy_utilities",
  "logistics_transport",
  "retail_consumer",
  "other",
]);

const Figure = z
  .object({
    value: z.number().int().positive(),
    as_of: z.union([z.string(), z.number()]).nullable().optional(),
    source_url: z.string().url(),
    approx: z.boolean().optional(),
  })
  .nullable()
  .optional();

export const CompanyRecord = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(2),
  brand: z.string().nullable().optional(),
  website: z.string().url(),
  domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,24}$/),
  group_website: z.string().url().nullable().optional(),
  sector: SECTOR,
  subsector: z.string().nullable().optional(),
  hq_country: z.string().nullable().optional(),
  polish_presence: z.object({
    summary: z.string().min(3),
    evidence_url: z.string().url(),
    locations: z.array(z.string()).optional().default([]),
  }),
  parent: z.string().nullable().optional(),
  relationship: z.string().nullable().optional(),
  relationship_note: z.string().nullable().optional(),
  employees_global: Figure,
  employees_poland: Figure,
  size_band: z.enum(["200-999", "1000-4999", "5000+", "unknown", "<200"]).default("unknown"),
  size_basis: z.enum(["poland", "global", "unavailable"]).default("unavailable"),
  priority_signals: z.array(z.object({ signal: z.string(), url: z.string().url() })).default([]),
  sources: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().nullable().optional(),
        used_for: z.array(z.string()).default([]),
      }),
    )
    .min(1),
  website_check: z
    .object({
      status: z.number().int(),
      final_url: z.string(),
      checked_at: z.string(),
    })
    .nullable()
    .optional(),
  notes: z.string().nullable().optional(),
  researched_at: z.string(),
  researched_by: z.string(),
});

export type CompanyRecord = z.infer<typeof CompanyRecord>;

export function sizeBandFor(n: number | null | undefined): CompanyRecord["size_band"] {
  if (!n) return "unknown";
  if (n < 200) return "<200";
  if (n < 1000) return "200-999";
  if (n < 5000) return "1000-4999";
  return "5000+";
}
