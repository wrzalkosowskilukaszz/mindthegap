/** Contacts list query: shared by the URL state (client) and the SQL builder (server). */
import { z } from "zod";

const list = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (typeof v === "string" ? (v === "" ? [] : v.split(",")) : v), z.array(item)).optional();

export const ROLE_CATEGORIES = [
  "decision_maker",
  "organizer_influencer",
  "departmental_inbox",
  "general_routing",
  "uncertain",
] as const;
export const ROLE_FUNCTIONS = [
  "hr",
  "learning",
  "procurement",
  "business_leadership",
  "transformation",
  "people_culture",
  "other",
] as const;
export const CONTACT_KINDS = ["person", "department_inbox", "general_inbox"] as const;
export const QUALITIES = ["ready", "caution", "needs_research", "blocked"] as const;
export const EMAIL_STATUSES = ["not_checked", "valid", "invalid", "catch_all", "unknown", "expired"] as const;
export const OUTREACH = [
  "not_contacted",
  "draft_ready",
  "scheduled",
  "sent",
  "replied",
  "follow_up_due",
  "failed",
  "do_not_contact",
] as const;
export const REVIEW = ["new", "accepted", "rejected"] as const;
export const SIZE_BANDS = ["200-999", "1000-4999", "5000+", "unknown", "<200"] as const;
export const SORTS = [
  "company",
  "name",
  "role",
  "verification",
  "last_contact",
  "reply",
  "discovered",
  "quality",
] as const;

export const ContactQuery = z.object({
  view: z.string().optional(),
  q: z.string().max(200).optional(),
  companyId: z.string().uuid().optional(),
  sector: list(z.string()),
  size: list(z.enum(SIZE_BANDS)),
  role: list(z.enum(ROLE_CATEGORIES)),
  dept: list(z.enum(ROLE_FUNCTIONS)),
  kind: list(z.enum(CONTACT_KINDS)),
  quality: list(z.enum(QUALITIES)),
  email: list(z.enum(EMAIL_STATUSES)),
  outreach: list(z.enum(OUTREACH)),
  review: list(z.enum(REVIEW)),
  verifiedOlderThan: z.coerce.number().int().min(1).max(3650).optional(),
  verifiedWithin: z.coerce.number().int().min(1).max(3650).optional(),
  fallback: z.enum(["exclude", "include", "only"]).optional(),
  runId: z.string().uuid().optional(),
  latestRun: z.preprocess((v) => v === "1" || v === true, z.boolean()).optional(),
  sort: z.enum(SORTS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
export type ContactQuery = z.infer<typeof ContactQuery>;

/** Built-in saved views. Priority views exclude generic fallback contacts by default. */
export const BUILTIN_VIEWS: { id: string; name: string; query: Partial<ContactQuery>; hint: string }[] = [
  {
    id: "priority",
    name: "Priorytetowe",
    query: {
      fallback: "exclude",
      review: ["new", "accepted"],
      role: ["decision_maker", "organizer_influencer", "departmental_inbox"],
      sort: "quality",
    },
    hint: "Osoby i skrzynki związane z rozwojem, bez kontaktów ogólnych i odrzuconych.",
  },
  {
    id: "latest-run",
    name: "Nowe z ostatniego przebiegu",
    query: { latestRun: true, review: ["new"], fallback: "include" },
    hint: "Do przeglądu: dodane w ostatnim przebiegu odkrywania.",
  },
  {
    id: "review",
    name: "Do przeglądu",
    query: { review: ["new"], fallback: "exclude" },
    hint: "Nowe kontakty, których jeszcze nie oceniono.",
  },
  {
    id: "awaiting",
    name: "Czekają na odpowiedź",
    query: { outreach: ["sent", "follow_up_due"], fallback: "include" },
    hint: "Wysłane, bez odpowiedzi.",
  },
  {
    id: "replied",
    name: "Odpowiedzieli",
    query: { outreach: ["replied"], fallback: "include" },
    hint: "Kontakty z odpowiedzią.",
  },
  {
    id: "needs-research",
    name: "Do uzupełnienia",
    query: { quality: ["needs_research"], fallback: "exclude", review: ["new", "accepted"] },
    hint: "Brak adresu lub adres przewidziany i niezweryfikowany.",
  },
  {
    id: "fallback",
    name: "Kontakty ogólne",
    query: { fallback: "only" },
    hint: "Adresy typu info@, rekrutacja — tylko jako ostateczność.",
  },
  {
    id: "dnc",
    name: "Nie kontaktować",
    query: { outreach: ["do_not_contact"], fallback: "include", review: ["new", "accepted", "rejected"] },
    hint: "Wykluczone i oznaczone.",
  },
  {
    id: "all",
    name: "Wszystkie",
    query: { fallback: "include", review: ["new", "accepted"] },
    hint: "Wszystkie poza odrzuconymi.",
  },
];

export const DEFAULT_VIEW = "priority";

export function queryToSearch(q: Partial<ContactQuery>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(","));
    } else if (typeof v === "boolean") {
      if (v) p.set(k, "1");
    } else p.set(k, String(v));
  }
  return p.toString();
}

export const ROLE_LABEL: Record<(typeof ROLE_CATEGORIES)[number], string> = {
  decision_maker: "Prawdopodobny decydent",
  organizer_influencer: "Organizator / wpływ",
  departmental_inbox: "Skrzynka działu",
  general_routing: "Kontakt ogólny",
  uncertain: "Rola niepewna",
};

export const KIND_LABEL: Record<(typeof CONTACT_KINDS)[number], string> = {
  person: "Osoba",
  department_inbox: "Skrzynka działu",
  general_inbox: "Adres ogólny",
};

export const SECTOR_LABEL: Record<string, string> = {
  technology: "Technologia",
  telecom_media: "Telekomunikacja i media",
  financial_services: "Finanse i ubezpieczenia",
  business_services: "Usługi biznesowe / SSC",
  professional_services: "Doradztwo i usługi profesjonalne",
  pharma_healthcare: "Farmacja i ochrona zdrowia",
  manufacturing_industrial: "Produkcja i przemysł",
  energy_utilities: "Energetyka",
  logistics_transport: "Logistyka i transport",
  retail_consumer: "Handel i dobra konsumpcyjne",
  other: "Inne",
};

export const SIZE_LABEL: Record<(typeof SIZE_BANDS)[number], string> = {
  "<200": "< 200",
  "200-999": "200–999",
  "1000-4999": "1 000–4 999",
  "5000+": "5 000+",
  unknown: "Brak danych",
};
