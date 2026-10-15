import { eq } from "drizzle-orm";
import { ContactQuery } from "@/lib/contact-query";
import { EMAIL_ORIGIN_LABEL, EMAIL_STATUS_LABEL, ELIGIBILITY_LABEL, OUTREACH_LABEL, QUALITY_LABEL } from "@/lib/contact-rules";
import { toCsv } from "@/lib/csv";
import { db } from "@/server/db/client";
import { companies, contacts } from "@/server/db/schema";
import { api, searchParams } from "@/server/http";
import { buildWhere } from "@/server/services/contact-list";

export const GET = api(async (req) => {
  const q = ContactQuery.parse(Object.fromEntries(searchParams(req).entries()));
  const where = await buildWhere(q);
  const rows = await db()
    .select({ c: contacts, co: companies })
    .from(contacts)
    .innerJoin(companies, eq(contacts.companyId, companies.id))
    .where(where)
    .limit(20000);
  const headers = [
    "Firma", "Domena", "Sektor", "Osoba", "Dział", "Stanowisko", "Kategoria roli", "E-mail", "Pochodzenie adresu",
    "Weryfikacja", "Data weryfikacji", "Jakość", "Uprawnienie do kontaktu", "Status korespondencji", "Ostatni kontakt",
    "Odkryto", "Metoda", "ID kontaktu",
  ];
  const data = rows.map(({ c, co }) => [
    co.name, co.domain, co.sector, c.fullName, c.departmentLabel, c.title, c.roleCategory, c.email,
    EMAIL_ORIGIN_LABEL[c.emailOrigin], EMAIL_STATUS_LABEL[c.emailStatus], c.emailCheckedAt,
    QUALITY_LABEL[c.quality as keyof typeof QUALITY_LABEL] ?? c.quality, ELIGIBILITY_LABEL[c.eligibilityBasis],
    OUTREACH_LABEL[c.outreachStatus], c.lastContactedAt, c.discoveredAt, c.discoveryMethod, c.id,
  ]);
  const csv = toCsv(headers, data);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kontakty-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
});
