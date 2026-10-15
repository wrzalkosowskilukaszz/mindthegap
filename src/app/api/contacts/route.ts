import { z } from "zod";
import { ContactQuery } from "@/lib/contact-query";
import { assessRole } from "@/lib/roles";
import { badRequest, api, parseBody, searchParams } from "@/server/http";
import { listContacts, viewCounts } from "@/server/services/contact-list";
import { upsertContact } from "@/server/services/contacts";

export const GET = api(async (req) => {
  const sp = searchParams(req);
  const q = ContactQuery.parse(Object.fromEntries(sp.entries()));
  const [list, counts] = await Promise.all([listContacts(q), sp.get("counts") === "1" ? viewCounts() : Promise.resolve(null)]);
  return { ...list, counts };
});

const ManualContact = z.object({
  companyId: z.string().uuid(),
  kind: z.enum(["person", "department_inbox", "general_inbox"]),
  fullName: z.string().max(200).optional().nullable(),
  title: z.string().max(300).optional().nullable(),
  departmentLabel: z.string().max(200).optional().nullable(),
  email: z.string().max(254).optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export const POST = api(async (req) => {
  const b = await parseBody(req, ManualContact);
  if (b.kind === "person" && !b.fullName) throw badRequest("Podaj imię i nazwisko osoby.");
  const role = assessRole(b.title ?? b.departmentLabel);
  const out = await upsertContact({
    companyId: b.companyId,
    kind: b.kind,
    fullName: b.fullName,
    title: b.title,
    departmentLabel: b.departmentLabel,
    email: b.email,
    emailOrigin: b.email ? "user_entered" : "none",
    roleCategory: b.kind === "general_inbox" ? "general_routing" : b.kind === "department_inbox" ? "departmental_inbox" : role.category,
    roleRationale: role.label,
    discoveryMethod: "manual",
    evidence: [
      {
        kind: "user",
        supports: ["name", "role", ...(b.email ? (["email"] as const) : [])],
        url: b.sourceUrl ?? null,
        note: b.note ?? "Dodany ręcznie",
      },
    ],
  });
  if (out.action === "skipped") throw badRequest(`Nie dodano: ${out.reason === "suppressed" ? "adres lub firma na liście wykluczeń" : out.reason === "rejected" ? "kontakt był wcześniej odrzucony" : out.reason}`);
  return out;
});
