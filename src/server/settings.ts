/**
 * Typed application settings stored as JSON rows in `settings`, validated with Zod.
 * Defaults are operational policies chosen for a single owner; they are editable in Ustawienia.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db/client.ts";
import { settings } from "./db/schema.ts";

export const SECTORS = [
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
] as const;
export type Sector = (typeof SECTORS)[number];

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const SchedulerSettings = z.object({
  enabled: z.boolean().default(true),
  localTime: hhmm.default("07:00"),
  timezone: z.string().default("Europe/Warsaw"),
  onTimeWindowMinutes: z.number().int().min(15).max(720).default(75),
  replySyncIntervalMinutes: z.number().int().min(15).max(1440).default(60),
});

export const DiscoverySettings = z.object({
  sectors: z.array(z.enum(SECTORS)).default([...SECTORS.filter((s) => s !== "other")]),
  minEmployees: z.number().int().min(0).default(200),
  includeUnknownSize: z.boolean().default(true),
  regions: z.array(z.string()).default([]),
  roleIncludeKeywords: z.array(z.string()).default([]),
  roleExcludeKeywords: z
    .array(z.string())
    .default([
      "rekrut",
      "recruit",
      "talent acquisition",
      "talent sourcing",
      "payroll",
      "płac",
      "kadr i płac",
      "employer branding",
    ]),
  excludedDomains: z.array(z.string()).default([]),
  maxNewCompaniesPerRun: z.number().int().min(0).max(200).default(10),
  maxCompaniesResearchedPerRun: z.number().int().min(0).max(500).default(25),
  maxNewContactsPerRun: z.number().int().min(0).max(500).default(30),
  maxContactsPerCompany: z.number().int().min(1).max(10).default(4),
  maxEnrichmentsPerRun: z.number().int().min(0).max(200).default(10),
  maxRechecksPerRun: z.number().int().min(0).max(500).default(20),
  maxPagesPerCompany: z.number().int().min(1).max(30).default(10),
  minDelayMsPerHost: z.number().int().min(500).max(30000).default(2500),
  /** Companies researched in parallel (each on its own host; per-host delays still apply). */
  concurrency: z.number().int().min(1).max(8).default(4),
  dailySpendLimitUsd: z.number().min(0).default(1),
  monthlySpendLimitUsd: z.number().min(0).default(20),
  /** Hunter Free plan = 50 credits/month; Tavily free = 1,000. Raise after upgrading a plan. */
  monthlyProviderCredits: z.record(z.string(), z.number().min(0)).default({ hunter: 50, tavily: 1000 }),
  hunterDomainSearchLimit: z.number().int().min(1).max(10).default(3),
  hunterFoundOnly: z.boolean().default(true),
  /** AI reads role-mentioning text blocks the rules could not parse. Off by default: it costs money per company. */
  aiAssistedExtraction: z.boolean().default(false),
  /**
   * Blended USD per million AI tokens used to estimate AI cost. An assumption, not a quoted price:
   * check https://www.anthropic.com/pricing for the configured model and adjust.
   */
  aiUsdPerMillionTokens: z.number().min(0).default(25),
});

export const FreshnessSettings = z.object({
  emailReverifyDays: z.number().int().min(7).default(90),
  employmentRecheckDays: z.number().int().min(7).default(120),
  staleWarningDays: z.number().int().min(7).default(180),
  revisitNoContactDays: z.number().int().min(1).default(45),
  revisitSourceUnavailableDays: z.number().int().min(1).default(7),
  revisitNeedsEnrichmentDays: z.number().int().min(1).default(21),
});

export const OutreachSettings = z.object({
  followUpDays: z.number().int().min(1).max(60).default(7),
  recentCompanyContactDays: z.number().int().min(1).max(365).default(90),
  dailySendLimit: z.number().int().min(1).max(500).default(30),
  minSecondsBetweenSends: z.number().int().min(0).max(600).default(20),
  requireEligibilityBasis: z.boolean().default(true),
});

export const PrivacySettings = z.object({
  retentionMonthsNotContacted: z.number().int().min(1).max(120).default(24),
  retentionMonthsRejected: z.number().int().min(1).max(120).default(12),
  includePrivacyFooter: z.boolean().default(true),
  footerPl: z
    .string()
    .default(
      "Twój służbowy adres e-mail pochodzi z publicznie dostępnego źródła: {source}. Administratorem danych jest {controller}. Jeśli nie chcesz otrzymywać ode mnie wiadomości, odpowiedz „nie” — usunę Twoje dane z mojej bazy.",
    ),
  footerEn: z
    .string()
    .default(
      "I found your business email address in a publicly available source: {source}. The data controller is {controller}. If you'd rather not hear from me, reply “no” and I will delete your details.",
    ),
  controllerName: z.string().default(""),
});

export const ProfileFact = z.object({
  id: z.string(),
  text: z.string().min(1),
  source: z.string().default(""),
  approved: z.boolean().default(false),
});

export const WritingSample = z.object({
  id: z.string(),
  language: z.enum(["pl", "en"]),
  text: z.string().min(1),
  approved: z.boolean().default(false),
});

export const ProfileSettings = z.object({
  senderName: z.string().default(""),
  senderRole: z.string().default(""),
  businessName: z.string().default("Mind The Gap"),
  website: z.string().default("https://leadersmindthegap.com/"),
  voice: z.enum(["singular", "plural"]).default("singular"),
  plGrammaticalGender: z.enum(["feminine", "masculine", "avoid"]).default("avoid"),
  plAddress: z.enum(["pan_pani", "first_name"]).default("pan_pani"),
  facts: z.array(ProfileFact).default([]),
  toneNotes: z.string().default(""),
  avoidPhrases: z.array(z.string()).default([]),
  samples: z.array(WritingSample).default([]),
  signaturePl: z.string().default(""),
  signatureEn: z.string().default(""),
  defaultCtaPl: z.string().default(""),
  defaultCtaEn: z.string().default(""),
});

export const SETTINGS = {
  scheduler: SchedulerSettings,
  discovery: DiscoverySettings,
  freshness: FreshnessSettings,
  outreach: OutreachSettings,
  privacy: PrivacySettings,
  profile: ProfileSettings,
} as const;

export type SettingsKey = keyof typeof SETTINGS;
export type SettingsOf<K extends SettingsKey> = z.infer<(typeof SETTINGS)[K]>;

export async function getSettings<K extends SettingsKey>(key: K): Promise<SettingsOf<K>> {
  const [row] = await db().select().from(settings).where(eq(settings.key, key)).limit(1);
  const schema = SETTINGS[key];
  const parsed = schema.safeParse(row?.value ?? {});
  if (parsed.success) return parsed.data as SettingsOf<K>;
  // A stored value that no longer validates falls back to defaults rather than breaking the app.
  return schema.parse({}) as SettingsOf<K>;
}

export async function saveSettings<K extends SettingsKey>(key: K, value: unknown): Promise<SettingsOf<K>> {
  const parsed = SETTINGS[key].parse(value) as SettingsOf<K>;
  await db()
    .insert(settings)
    .values({ key, value: parsed })
    .onConflictDoUpdate({ target: settings.key, set: { value: parsed, updatedAt: new Date() } });
  return parsed;
}

export async function patchSettings<K extends SettingsKey>(
  key: K,
  patch: Partial<SettingsOf<K>>,
): Promise<SettingsOf<K>> {
  const current = await getSettings(key);
  return saveSettings(key, { ...current, ...patch });
}
