/**
 * Database schema (Drizzle, PostgreSQL).
 *
 * Design rules that the schema enforces or makes explicit:
 * - Role relevance, employment freshness, email verification and communication
 *   eligibility are four separate facts on a contact (never folded into one status).
 * - Every contact keeps provenance: evidence rows with URL / provider id, quote and dates.
 * - Verification history is append-only (`contact_verifications`) and keeps the raw provider result.
 * - Discovery runs are durable: `job_runs` + `job_tasks` with idempotency keys and leases.
 * - Paid provider calls go through the `provider_usage` ledger (reserve → commit / release).
 * - Sent messages keep the exact attachment versions (`message_attachments`).
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const sectorEnum = pgEnum("sector", [
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

export const companyOriginEnum = pgEnum("company_origin", [
  "initial_universe",
  "discovery",
  "manual",
  "import",
]);

export const researchStatusEnum = pgEnum("research_status", [
  "queued",
  "in_progress",
  "researched",
  "needs_more_work",
  "excluded",
]);

export const researchOutcomeEnum = pgEnum("research_outcome", [
  "relevant_contact_found",
  "person_found_email_unavailable",
  "department_found_no_named_contact",
  "general_contact_only",
  "needs_provider_enrichment",
  "no_suitable_contact",
  "source_unavailable",
  "research_incomplete",
]);

export const contactKindEnum = pgEnum("contact_kind", ["person", "department_inbox", "general_inbox"]);

export const roleCategoryEnum = pgEnum("role_category", [
  "decision_maker",
  "organizer_influencer",
  "departmental_inbox",
  "general_routing",
  "uncertain",
]);

/** Department / function a contact sits in (who organises, buys or budgets training). */
export const roleFunctionEnum = pgEnum("role_function", [
  "hr",
  "learning",
  "procurement",
  "business_leadership",
  "transformation",
  "people_culture",
  "other",
]);

export const emailOriginEnum = pgEnum("email_origin", [
  "published_source",
  "provider_with_sources",
  "provider_pattern",
  "user_entered",
  "imported",
  "none",
]);

export const emailStatusEnum = pgEnum("email_status", [
  "not_checked",
  "valid",
  "invalid",
  "catch_all",
  "unknown",
  "expired",
]);

export const employmentStatusEnum = pgEnum("employment_status", [
  "confirmed_recent",
  "dated_evidence",
  "unverified",
  "possibly_left",
  "left",
]);

export const reviewStatusEnum = pgEnum("review_status", ["new", "accepted", "rejected"]);

export const eligibilityBasisEnum = pgEnum("eligibility_basis", [
  "not_assessed",
  "consent",
  "invitation_to_offer",
  "prior_relationship",
  "other_documented",
  "do_not_contact",
]);

export const outreachStatusEnum = pgEnum("outreach_status", [
  "not_contacted",
  "draft_ready",
  "scheduled",
  "sent",
  "replied",
  "follow_up_due",
  "failed",
  "do_not_contact",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "draft",
  "approved",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "uncertain",
  "cancelled",
]);

export const messageLanguageEnum = pgEnum("message_language", ["pl", "en"]);

export const documentUsageEnum = pgEnum("document_usage", ["internal", "quotable", "attachment"]);

export const extractionStatusEnum = pgEnum("extraction_status", [
  "pending",
  "ok",
  "partial",
  "unsupported",
  "failed",
]);

export const programStatusEnum = pgEnum("program_status", ["draft", "approved", "archived"]);

export const runStatusEnum = pgEnum("run_status", [
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled",
  "budget_exhausted",
]);

export const taskStatusEnum = pgEnum("task_status", ["pending", "running", "done", "failed", "skipped"]);

export const inboundClassEnum = pgEnum("inbound_class", ["human_reply", "auto_reply", "bounce", "unknown"]);

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export type SizeFigure = { value: number; asOf: string | null; sourceUrl: string; approx?: boolean };
export type PrioritySignal = { signal: string; url: string };

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    brand: text("brand"),
    website: text("website"),
    domain: text("domain").notNull(),
    groupWebsite: text("group_website"),
    sector: sectorEnum("sector").notNull().default("other"),
    subsector: text("subsector"),
    hqCountry: text("hq_country"),
    polishPresenceSummary: text("polish_presence_summary"),
    polishPresenceUrl: text("polish_presence_url"),
    locations: jsonb("locations").$type<string[]>().notNull().default([]),
    parentName: text("parent_name"),
    parentCompanyId: uuid("parent_company_id"),
    relationship: text("relationship"),
    relationshipNote: text("relationship_note"),
    employeesGlobal: jsonb("employees_global").$type<SizeFigure | null>(),
    employeesPoland: jsonb("employees_poland").$type<SizeFigure | null>(),
    sizeBand: text("size_band").notNull().default("unknown"),
    sizeBasis: text("size_basis").notNull().default("unavailable"),
    prioritySignals: jsonb("priority_signals").$type<PrioritySignal[]>().notNull().default([]),
    origin: companyOriginEnum("origin").notNull().default("manual"),
    researchStatus: researchStatusEnum("research_status").notNull().default("queued"),
    researchOutcome: researchOutcomeEnum("research_outcome"),
    researchNote: text("research_note"),
    researchAttempts: integer("research_attempts").notNull().default(0),
    lastResearchedAt: ts("last_researched_at"),
    nextResearchAt: ts("next_research_at"),
    excluded: boolean("excluded").notNull().default(false),
    excludedReason: text("excluded_reason"),
    notes: text("notes"),
    researchedBy: text("researched_by"),
    universeResearchedAt: date("universe_researched_at"),
    websiteCheck: jsonb("website_check").$type<{
      status: number;
      finalUrl: string;
      checkedAt: string;
    } | null>(),
    isDemo: boolean("is_demo").notNull().default(false),
    /** A company you would like to work for: all its EU job offers are shown (Oferty pracy). */
    favourite: boolean("favourite").notNull().default(false),
    careersUrl: text("careers_url"),
    careersCheckedAt: ts("careers_checked_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("companies_slug_uq").on(t.slug),
    uniqueIndex("companies_domain_uq").on(t.domain),
    index("companies_research_idx").on(t.researchStatus, t.nextResearchAt),
    index("companies_sector_idx").on(t.sector),
  ],
);

export const companySources = pgTable(
  "company_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title"),
    usedFor: jsonb("used_for").$type<string[]>().notNull().default([]),
    accessedAt: date("accessed_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("company_sources_uq").on(t.companyId, t.url)],
);

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export type ProviderResult = { provider: string; raw: unknown; at: string };

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    kind: contactKindEnum("kind").notNull(),
    fullName: text("full_name"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    nameKey: text("name_key"),
    departmentLabel: text("department_label"),
    title: text("title"),
    roleCategory: roleCategoryEnum("role_category").notNull().default("uncertain"),
    roleRationale: text("role_rationale"),
    roleFunction: roleFunctionEnum("role_function").notNull().default("other"),
    email: text("email"),
    emailNormalized: text("email_normalized"),
    emailOrigin: emailOriginEnum("email_origin").notNull().default("none"),
    emailStatus: emailStatusEnum("email_status").notNull().default("not_checked"),
    emailCheckedAt: ts("email_checked_at"),
    emailProviderResult: jsonb("email_provider_result").$type<ProviderResult | null>(),
    employmentStatus: employmentStatusEnum("employment_status").notNull().default("unverified"),
    employmentCheckedAt: ts("employment_checked_at"),
    sourcePublishedAt: date("source_published_at"),
    discoveredAt: ts("discovered_at").notNull().defaultNow(),
    discoveredByRunId: uuid("discovered_by_run_id"),
    discoveryMethod: text("discovery_method").notNull().default("manual"),
    reviewStatus: reviewStatusEnum("review_status").notNull().default("new"),
    reviewedAt: ts("reviewed_at"),
    rejectedReason: text("rejected_reason"),
    eligibilityBasis: eligibilityBasisEnum("eligibility_basis").notNull().default("not_assessed"),
    eligibilityEvidence: text("eligibility_evidence"),
    eligibilityEvidenceUrl: text("eligibility_evidence_url"),
    eligibilityScope: text("eligibility_scope"),
    eligibilityDate: date("eligibility_date"),
    eligibilityRecordedAt: ts("eligibility_recorded_at"),
    outreachStatus: outreachStatusEnum("outreach_status").notNull().default("not_contacted"),
    lastContactedAt: ts("last_contacted_at"),
    lastReplyAt: ts("last_reply_at"),
    followUpAt: ts("follow_up_at"),
    previousContactId: uuid("previous_contact_id"),
    movedToContactId: uuid("moved_to_contact_id"),
    conflicts: text("conflicts"),
    /** Derived by `assessContact` (src/lib/contact-rules.ts); recomputed on change and daily. */
    quality: text("quality").notNull().default("needs_research"),
    qualityReasons: jsonb("quality_reasons").$type<string[]>().notNull().default([]),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("contacts_email_uq").on(t.emailNormalized).where(sql`${t.emailNormalized} is not null`),
    uniqueIndex("contacts_person_uq").on(t.companyId, t.nameKey).where(sql`${t.nameKey} is not null`),
    index("contacts_company_idx").on(t.companyId),
    index("contacts_review_idx").on(t.reviewStatus, t.discoveredAt),
    index("contacts_outreach_idx").on(t.outreachStatus),
  ],
);

export const contactEvidence = pgTable(
  "contact_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // source_page | provider | search_result | user | import
    supports: jsonb("supports").$type<string[]>().notNull().default([]), // name | role | email | employment
    url: text("url"),
    title: text("title"),
    provider: text("provider"),
    providerRef: text("provider_ref"),
    quote: text("quote"),
    quoteVerified: boolean("quote_verified").notNull().default(false),
    sourcePublishedAt: date("source_published_at"),
    observedAt: ts("observed_at").notNull().defaultNow(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("contact_evidence_contact_idx").on(t.contactId)],
);

export const contactVerifications = pgTable(
  "contact_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    provider: text("provider").notNull(),
    status: emailStatusEnum("status").notNull(),
    providerStatus: text("provider_status"),
    score: integer("score"),
    raw: jsonb("raw"),
    checkedAt: ts("checked_at").notNull().defaultNow(),
  },
  (t) => [index("contact_verifications_contact_idx").on(t.contactId, t.checkedAt)],
);

export const contactEvents = pgTable(
  "contact_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("contact_events_contact_idx").on(t.contactId, t.createdAt)],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("notes_contact_idx").on(t.contactId)],
);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    messageId: uuid("message_id"),
    dueAt: ts("due_at").notNull(),
    note: text("note"),
    doneAt: ts("done_at"),
    createdAt: createdAt(),
  },
  (t) => [index("reminders_due_idx").on(t.doneAt, t.dueAt)],
);

export const suppressions = pgTable(
  "suppressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(), // email | domain | company | person
    value: text("value").notNull(), // normalized
    reason: text("reason"),
    source: text("source").notNull().default("user"), // user | opt_out | bounce | import | rejected
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("suppressions_uq").on(t.kind, t.value)],
);

export const savedViews = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  query: jsonb("query").$type<Record<string, unknown>>().notNull(),
  position: integer("position").notNull().default(100),
  builtIn: boolean("built_in").notNull().default(false),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

export type ProgramField = { value: string; quote?: string | null; quoteVerified?: boolean };
export type ProgramSummary = {
  audience?: ProgramField;
  problem?: ProgramField;
  outcomes?: ProgramField[];
  format?: ProgramField;
  duration?: ProgramField;
  language?: ProgramField;
  pricing?: ProgramField | null;
  keyPoints?: ProgramField[];
};

export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: programStatusEnum("status").notNull().default("draft"),
  summary: jsonb("summary").$type<ProgramSummary>().notNull().default({}),
  summarySource: text("summary_source"), // e.g. "website 2026-10-15" | "document <id>" | "manual"
  defaultAttachmentVersionId: uuid("default_attachment_version_id"),
  approvedAt: ts("approved_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  programId: uuid("program_id").references(() => programs.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  usage: documentUsageEnum("usage").notNull().default("internal"),
  approvedAt: ts("approved_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    chunkCount: integer("chunk_count").notNull().default(0),
    complete: boolean("complete").notNull().default(false),
    extractedText: text("extracted_text"),
    extractionStatus: extractionStatusEnum("extraction_status").notNull().default("pending"),
    extractionError: text("extraction_error"),
    approvedAt: ts("approved_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("document_versions_uq").on(t.documentId, t.version)],
);

export const fileChunks = pgTable(
  "file_chunks",
  {
    versionId: uuid("version_id")
      .notNull()
      .references(() => documentVersions.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    data: bytea("data").notNull(),
  },
  (t) => [primaryKey({ columns: [t.versionId, t.idx] })],
);

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type GenerationMeta = {
  model?: string;
  promptVersion?: string;
  explanation?: string[];
  sources?: { label: string; url?: string | null }[];
  warnings?: string[];
  subjectOptions?: string[];
  variants?: { kind: string; body: string }[];
  generatedAt?: string;
};

export type ApprovalSnapshot = {
  hash: string;
  approvedAt: string;
  to: string;
  subject: string;
  attachmentVersionIds: string[];
  staleAcknowledged?: boolean;
  companyContactAcknowledged?: boolean;
};

export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  programId: uuid("program_id").references(() => programs.id, { onDelete: "set null" }),
  language: messageLanguageEnum("language").notNull(),
  createdAt: createdAt(),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    programId: uuid("program_id").references(() => programs.id, { onDelete: "set null" }),
    batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),
    parentMessageId: uuid("parent_message_id"),
    kind: text("kind").notNull().default("initial"), // initial | follow_up
    language: messageLanguageEnum("language").notNull(),
    toEmail: text("to_email"),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    userEdited: boolean("user_edited").notNull().default(false),
    generation: jsonb("generation").$type<GenerationMeta>().notNull().default({}),
    status: messageStatusEnum("status").notNull().default("draft"),
    approval: jsonb("approval").$type<ApprovalSnapshot | null>(),
    scheduledFor: ts("scheduled_for"),
    sentAt: ts("sent_at"),
    /** "gmail" = accepted by Gmail through the app; "manual" = the owner sent it from their own mail app. */
    sentVia: text("sent_via"),
    rfcMessageId: text("rfc_message_id"),
    gmailMessageId: text("gmail_message_id"),
    gmailThreadId: text("gmail_thread_id"),
    sendError: text("send_error"),
    revision: integer("revision").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("messages_status_idx").on(t.status, t.scheduledFor),
    index("messages_contact_idx").on(t.contactId, t.createdAt),
    index("messages_company_idx").on(t.companyId, t.sentAt),
    uniqueIndex("messages_rfc_uq").on(t.rfcMessageId).where(sql`${t.rfcMessageId} is not null`),
  ],
);

export const messageRevisions = pgTable(
  "message_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    rev: integer("rev").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    origin: text("origin").notNull(), // generated | edit | quick_action | restore | variant
    label: text("label"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("message_revisions_uq").on(t.messageId, t.rev)],
);

export const messageAttachments = pgTable(
  "message_attachments",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .notNull()
      .references(() => documentVersions.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.versionId] })],
);

export const sendAttempts = pgTable(
  "send_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // started | accepted | failed | uncertain | reconciled_sent | reconciled_not_sent
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    response: jsonb("response"),
    error: text("error"),
  },
  (t) => [index("send_attempts_message_idx").on(t.messageId)],
);

export const inboundMessages = pgTable(
  "inbound_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gmailMessageId: text("gmail_message_id").notNull(),
    gmailThreadId: text("gmail_thread_id").notNull(),
    messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    fromEmail: text("from_email"),
    receivedAt: ts("received_at").notNull(),
    subject: text("subject"),
    classification: inboundClassEnum("classification").notNull().default("unknown"),
    classifiedBy: text("classified_by").notNull().default("auto"), // auto | user
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("inbound_gmail_uq").on(t.gmailMessageId),
    index("inbound_contact_idx").on(t.contactId, t.receivedAt),
  ],
);

// ---------------------------------------------------------------------------
// Google account (Gmail)
// ---------------------------------------------------------------------------

export const googleAccounts = pgTable("google_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  refreshTokenEnc: text("refresh_token_enc"),
  accessTokenEnc: text("access_token_enc"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  status: text("status").notNull().default("connected"), // connected | needs_reauth | disconnected
  statusDetail: text("status_detail"),
  lastSyncAt: ts("last_sync_at"),
  lastSyncOk: boolean("last_sync_ok"),
  lastSyncError: text("last_sync_error"),
  connectedAt: ts("connected_at").notNull().defaultNow(),
  updatedAt: updatedAt(),
});

export const oauthStates = pgTable("oauth_states", {
  state: text("state").primaryKey(),
  codeVerifier: text("code_verifier").notNull(),
  purpose: text("purpose").notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Jobs, scheduler, spending
// ---------------------------------------------------------------------------

export type RunStats = {
  companiesDiscovered?: number;
  companiesResearched?: number;
  contactsNew?: number;
  contactsUpdated?: number;
  contactsRechecked?: number;
  emailsVerified?: number;
  pagesFetched?: number;
  tasksDone?: number;
  tasksFailed?: number;
  tasksSkipped?: number;
  unresolvedCompanies?: number;
};

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(), // discovery
    trigger: text("trigger").notNull(), // schedule | manual | catch_up
    localDate: date("local_date"),
    status: runStatusEnum("status").notNull().default("queued"),
    plan: jsonb("plan").$type<Record<string, unknown>>().notNull().default({}),
    stats: jsonb("stats").$type<RunStats>().notNull().default({}),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    error: text("error"),
    leaseOwner: text("lease_owner"),
    leaseUntil: ts("lease_until"),
    heartbeatAt: ts("heartbeat_at"),
    createdAt: createdAt(),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
  },
  (t) => [
    uniqueIndex("job_runs_scheduled_uq")
      .on(t.kind, t.localDate)
      .where(sql`${t.trigger} in ('schedule','catch_up')`),
    index("job_runs_status_idx").on(t.status, t.createdAt),
  ],
);

export const jobTasks = pgTable(
  "job_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => jobRuns.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // find_companies | research_company | enrich_contact | recheck_contact
    key: text("key").notNull(),
    targetId: uuid("target_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: taskStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    nextAttemptAt: ts("next_attempt_at"),
    leaseUntil: ts("lease_until"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    createdAt: createdAt(),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
  },
  (t) => [
    uniqueIndex("job_tasks_key_uq").on(t.runId, t.key),
    index("job_tasks_status_idx").on(t.runId, t.status),
  ],
);

export const leases = pgTable("leases", {
  name: text("name").primaryKey(),
  holder: text("holder").notNull(),
  expiresAt: ts("expires_at").notNull(),
});

export const providerUsage = pgTable(
  "provider_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    operation: text("operation").notNull(),
    credits: doublePrecision("credits").notNull().default(0),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    status: text("status").notNull(), // reserved | committed | released
    runId: uuid("run_id"),
    taskId: uuid("task_id"),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("provider_usage_time_idx").on(t.createdAt)],
);

export const hostState = pgTable("host_state", {
  host: text("host").primaryKey(),
  robotsTxt: text("robots_txt"),
  robotsStatus: integer("robots_status"),
  robotsFetchedAt: ts("robots_fetched_at"),
  lastFetchAt: ts("last_fetch_at"),
  consecutiveErrors: integer("consecutive_errors").notNull().default(0),
});

export const fetchLog = pgTable(
  "fetch_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id"),
    url: text("url").notNull(),
    host: text("host").notNull(),
    status: integer("status"),
    outcome: text("outcome").notNull(), // ok | robots_disallowed | http_error | network_error | skipped_type | too_large
    bytes: integer("bytes"),
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
  },
  (t) => [index("fetch_log_host_idx").on(t.host, t.fetchedAt)],
);

export const appEvents = pgTable(
  "app_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    level: text("level").notNull(), // info | warning | error
    category: text("category").notNull(), // discovery | gmail | provider | ai | scheduler | auth | import
    message: text("message").notNull(),
    context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
    runId: uuid("run_id"),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
  },
  (t) => [index("app_events_open_idx").on(t.resolvedAt, t.level, t.createdAt)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Auth (single owner)
// ---------------------------------------------------------------------------

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the session token
  createdAt: createdAt(),
  expiresAt: ts("expires_at").notNull(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  userAgent: text("user_agent"),
});

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ipHash: text("ip_hash").notNull(),
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_idx").on(t.ipHash, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Job offers (Oferty pracy)
// ---------------------------------------------------------------------------

export const jobSourceKindEnum = pgEnum("job_source_kind", [
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
  "workable",
  "recruitee",
  "personio",
  "teamtailor",
  "eightfold",
  "workday",
  "successfactors",
  "arbeitnow",
  "himalayas",
  "adzuna",
  "jooble",
  "manual",
  "careers_page",
]);

export const jobOfferStatusEnum = pgEnum("job_offer_status", ["new", "saved", "applied", "dismissed"]);

/** Where offers come from: a company's public job board (found on its careers page) or a job feed. */
export const jobSources = pgTable(
  "job_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: jobSourceKindEnum("kind").notNull(),
    token: text("token").notNull(),
    name: text("name").notNull(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    url: text("url"),
    supported: boolean("supported").notNull().default(true),
    enabled: boolean("enabled").notNull().default(true),
    lastFetchedAt: ts("last_fetched_at"),
    nextFetchAt: ts("next_fetch_at"),
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    jobsTotal: integer("jobs_total").notNull().default(0),
    jobsKept: integer("jobs_kept").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("job_sources_kind_token_uq").on(t.kind, t.token),
    index("job_sources_due_idx").on(t.nextFetchAt),
  ],
);

export type JobMatch = {
  reasons: { text: string; tone: "good" | "warn" | "bad" }[];
  region: string;
  requiredLanguages: string[];
  hits: string[];
};

export const jobOffers = pgTable(
  "job_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => jobSources.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    companyName: text("company_name").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    workplace: text("workplace").notNull().default("unknown"),
    employmentType: text("employment_type"),
    department: text("department"),
    description: text("description").notNull().default(""),
    url: text("url").notNull(),
    postedAt: ts("posted_at"),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    closedAt: ts("closed_at"),
    score: integer("score").notNull().default(0),
    match: jsonb("match")
      .$type<JobMatch>()
      .notNull()
      .default({ reasons: [], region: "unknown", requiredLanguages: [], hits: [] }),
    status: jobOfferStatusEnum("status").notNull().default("new"),
    statusAt: ts("status_at"),
    note: text("note"),
    /** The owner's CV rewritten for this offer (pasted back from ChatGPT / Claude). */
    tailoredCv: text("tailored_cv"),
    tailoredCvAt: ts("tailored_cv_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("job_offers_source_ext_uq").on(t.sourceId, t.externalId),
    index("job_offers_list_idx").on(t.status, t.score),
    index("job_offers_company_idx").on(t.companyId),
  ],
);

// ------------------------------------------------------------------------------------------------
// Zapytania ofertowe: requests for quotes for training work, read from Baza Konkurencyjności
// ------------------------------------------------------------------------------------------------

export const tenderStatusEnum = pgEnum("tender_status", ["new", "saved", "applied", "dismissed"]);

export type TenderReasons = { text: string; tone: "good" | "warn" | "bad" }[];
export type TenderDetail = {
  description: string;
  conditions: string[];
  criteria: string[];
  attachments: string[];
  places: string[];
  advertiserCity: string | null;
};

export const tenders = pgTable(
  "tenders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** "bk": Baza Konkurencyjności (Ministerstwo Funduszy i Polityki Regionalnej). */
    source: text("source").notNull().default("bk"),
    externalId: text("external_id").notNull(),
    number: text("number"),
    title: text("title").notNull(),
    advertiser: text("advertiser").notNull(),
    place: text("place"),
    snippet: text("snippet").notNull().default(""),
    url: text("url").notNull(),
    publishedOn: date("published_on"),
    deadlineAt: ts("deadline_at"),
    detail: jsonb("detail").$type<TenderDetail>(),
    detailFetchedAt: ts("detail_fetched_at"),
    score: integer("score").notNull().default(0),
    reasons: jsonb("reasons").$type<TenderReasons>().notNull().default([]),
    status: tenderStatusEnum("status").notNull().default("new"),
    statusAt: ts("status_at"),
    note: text("note"),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    closedAt: ts("closed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("tenders_source_ext_uq").on(t.source, t.externalId),
    index("tenders_list_idx").on(t.status, t.score),
  ],
);

// ------------------------------------------------------------------------------------------------
// Wydarzenia: events where L&D and HR buyers meet, and pages watched for new dates
// ------------------------------------------------------------------------------------------------

export const eventStatusEnum = pgEnum("event_status", ["new", "saved", "going", "dismissed"]);

/** One row per source in src/server/events/sources.ts (feeds and watched pages). */
export const eventSources = pgTable("event_sources", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  kind: text("kind").notNull(),
  lastCheckedAt: ts("last_checked_at"),
  lastStatus: text("last_status"),
  lastError: text("last_error"),
  eventsFound: integer("events_found").notNull().default(0),
  /** Watched pages: the lines with dates seen last time, their hash, and when they changed. */
  lines: jsonb("lines").$type<string[]>(),
  linesHash: text("lines_hash"),
  newLines: jsonb("new_lines").$type<string[]>(),
  changedAt: ts("changed_at"),
  seenAt: ts("seen_at"),
  updatedAt: updatedAt(),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** An event_sources key, or "manual". */
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    organiser: text("organiser"),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at"),
    allDay: boolean("all_day").notNull().default(false),
    place: text("place"),
    online: boolean("online").notNull().default(false),
    url: text("url").notNull(),
    description: text("description").notNull().default(""),
    price: text("price"),
    score: integer("score").notNull().default(0),
    reasons: jsonb("reasons").$type<TenderReasons>().notNull().default([]),
    status: eventStatusEnum("status").notNull().default("new"),
    statusAt: ts("status_at"),
    note: text("note"),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("events_source_ext_uq").on(t.source, t.externalId),
    index("events_starts_idx").on(t.startsAt),
  ],
);
