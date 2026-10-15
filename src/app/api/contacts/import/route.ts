import { eq, sql } from "drizzle-orm";
import Papa from "papaparse";
import { mapHeaders } from "@/lib/csv";
import { emailDomain, normalizeEmail, registrableDomain } from "@/lib/normalize";
import { assessRole } from "@/lib/roles";
import { db } from "@/server/db/client";
import { companies } from "@/server/db/schema";
import { logEvent } from "@/server/events";
import { api, badRequest } from "@/server/http";
import { upsertContact } from "@/server/services/contacts";
import { classifyMailbox, slugify } from "@/lib/normalize";

const MAX_BYTES = 2_000_000;

/**
 * CSV import. Rows are data, never instructions. Suppression and rejection memory apply.
 * Unknown companies are created only when a domain is given (origin "import").
 */
export const POST = api(async (req) => {
  const text = await req.text();
  if (text.length > MAX_BYTES) throw badRequest("Plik jest za duży (limit 2 MB).");
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
  if (!parsed.meta.fields?.length) throw badRequest("Nie rozpoznano nagłówków CSV.");
  const map = mapHeaders(parsed.meta.fields);
  if (!map.email && !map.fullName && !(map.firstName && map.lastName)) {
    throw badRequest("CSV musi mieć kolumnę e-mail lub imię i nazwisko.");
  }
  const report = { rows: parsed.data.length, created: 0, updated: 0, unchanged: 0, skipped: 0, errors: [] as string[] };
  for (const [i, row] of parsed.data.slice(0, 5000).entries()) {
    const get = (k: string) => (map[k] ? (row[map[k]!] ?? "").trim() : "");
    const email = normalizeEmail(get("email"));
    const fullName = get("fullName") || [get("firstName"), get("lastName")].filter(Boolean).join(" ") || null;
    const domain = registrableDomain(get("domain") || (email ? emailDomain(email) : ""));
    let companyId: string | undefined;
    if (domain) {
      const [co] = await db().select({ id: companies.id }).from(companies).where(eq(companies.domain, domain)).limit(1);
      companyId = co?.id;
    }
    if (!companyId && get("company")) {
      const [co] = await db()
        .select({ id: companies.id })
        .from(companies)
        .where(sql`lower(${companies.name}) = lower(${get("company")}) or lower(${companies.brand}) = lower(${get("company")})`)
        .limit(1);
      companyId = co?.id;
    }
    if (!companyId && domain) {
      const name = get("company") || domain;
      const [co] = await db()
        .insert(companies)
        .values({ slug: `${slugify(name)}-${domain.replace(/\./g, "-")}`.slice(0, 90), name, domain, website: `https://${domain}/`, origin: "import" })
        .onConflictDoNothing()
        .returning({ id: companies.id });
      companyId = co?.id;
    }
    if (!companyId) {
      report.skipped++;
      report.errors.push(`Wiersz ${i + 2}: brak firmy lub domeny`);
      continue;
    }
    const title = get("title") || null;
    const department = get("department") || null;
    const mailbox = email ? classifyMailbox(email) : null;
    const kind = fullName ? "person" : mailbox === "development" || mailbox === "hr" ? "department_inbox" : "general_inbox";
    const role = assessRole(title ?? department);
    const out = await upsertContact({
      companyId,
      kind,
      fullName,
      title,
      departmentLabel: department,
      email,
      emailOrigin: email ? "imported" : "none",
      roleCategory: kind === "person" ? role.category : kind === "department_inbox" ? "departmental_inbox" : "general_routing",
      roleRationale: role.label,
      discoveryMethod: "csv_import",
      evidence: [
        {
          kind: "import",
          supports: ["name", "role", ...(email ? (["email"] as const) : [])],
          url: get("sourceUrl") || null,
          note: get("note") || "Import CSV",
        },
      ],
    });
    if (out.action === "created") report.created++;
    else if (out.action === "updated") report.updated++;
    else if (out.action === "unchanged") report.unchanged++;
    else {
      report.skipped++;
      if (report.errors.length < 50) report.errors.push(`Wiersz ${i + 2}: pominięty (${out.reason})`);
    }
  }
  await logEvent("info", "import", `Import CSV: ${report.created} nowych, ${report.updated} zaktualizowanych, ${report.skipped} pominiętych`);
  return report;
});
