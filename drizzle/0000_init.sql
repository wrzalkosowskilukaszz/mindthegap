CREATE TYPE "public"."company_origin" AS ENUM('initial_universe', 'discovery', 'manual', 'import');--> statement-breakpoint
CREATE TYPE "public"."contact_kind" AS ENUM('person', 'department_inbox', 'general_inbox');--> statement-breakpoint
CREATE TYPE "public"."document_usage" AS ENUM('internal', 'quotable', 'attachment');--> statement-breakpoint
CREATE TYPE "public"."eligibility_basis" AS ENUM('not_assessed', 'consent', 'invitation_to_offer', 'prior_relationship', 'other_documented', 'do_not_contact');--> statement-breakpoint
CREATE TYPE "public"."email_origin" AS ENUM('published_source', 'provider_with_sources', 'provider_pattern', 'user_entered', 'imported', 'none');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('not_checked', 'valid', 'invalid', 'catch_all', 'unknown', 'expired');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('confirmed_recent', 'dated_evidence', 'unverified', 'possibly_left', 'left');--> statement-breakpoint
CREATE TYPE "public"."extraction_status" AS ENUM('pending', 'ok', 'partial', 'unsupported', 'failed');--> statement-breakpoint
CREATE TYPE "public"."inbound_class" AS ENUM('human_reply', 'auto_reply', 'bounce', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."message_language" AS ENUM('pl', 'en');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('draft', 'approved', 'scheduled', 'sending', 'sent', 'failed', 'uncertain', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."outreach_status" AS ENUM('not_contacted', 'draft_ready', 'scheduled', 'sent', 'replied', 'follow_up_due', 'failed', 'do_not_contact');--> statement-breakpoint
CREATE TYPE "public"."program_status" AS ENUM('draft', 'approved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."research_outcome" AS ENUM('relevant_contact_found', 'person_found_email_unavailable', 'department_found_no_named_contact', 'general_contact_only', 'needs_provider_enrichment', 'no_suitable_contact', 'source_unavailable', 'research_incomplete');--> statement-breakpoint
CREATE TYPE "public"."research_status" AS ENUM('queued', 'in_progress', 'researched', 'needs_more_work', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('new', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role_category" AS ENUM('decision_maker', 'organizer_influencer', 'departmental_inbox', 'general_routing', 'uncertain');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled', 'budget_exhausted');--> statement-breakpoint
CREATE TYPE "public"."sector" AS ENUM('technology', 'telecom_media', 'financial_services', 'business_services', 'professional_services', 'pharma_healthcare', 'manufacturing_industrial', 'energy_utilities', 'logistics_transport', 'retail_consumer', 'other');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'running', 'done', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "app_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"run_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"program_id" uuid,
	"language" "message_language" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"website" text,
	"domain" text NOT NULL,
	"group_website" text,
	"sector" "sector" DEFAULT 'other' NOT NULL,
	"subsector" text,
	"hq_country" text,
	"polish_presence_summary" text,
	"polish_presence_url" text,
	"locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parent_name" text,
	"parent_company_id" uuid,
	"relationship" text,
	"relationship_note" text,
	"employees_global" jsonb,
	"employees_poland" jsonb,
	"size_band" text DEFAULT 'unknown' NOT NULL,
	"size_basis" text DEFAULT 'unavailable' NOT NULL,
	"priority_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"origin" "company_origin" DEFAULT 'manual' NOT NULL,
	"research_status" "research_status" DEFAULT 'queued' NOT NULL,
	"research_outcome" "research_outcome",
	"research_note" text,
	"research_attempts" integer DEFAULT 0 NOT NULL,
	"last_researched_at" timestamp with time zone,
	"next_research_at" timestamp with time zone,
	"excluded" boolean DEFAULT false NOT NULL,
	"excluded_reason" text,
	"notes" text,
	"researched_by" text,
	"universe_researched_at" date,
	"website_check" jsonb,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"used_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"accessed_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"type" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"supports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"url" text,
	"title" text,
	"provider" text,
	"provider_ref" text,
	"quote" text,
	"quote_verified" boolean DEFAULT false NOT NULL,
	"source_published_at" date,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"email" text NOT NULL,
	"provider" text NOT NULL,
	"status" "email_status" NOT NULL,
	"provider_status" text,
	"score" integer,
	"raw" jsonb,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" "contact_kind" NOT NULL,
	"full_name" text,
	"first_name" text,
	"last_name" text,
	"name_key" text,
	"department_label" text,
	"title" text,
	"role_category" "role_category" DEFAULT 'uncertain' NOT NULL,
	"role_rationale" text,
	"email" text,
	"email_normalized" text,
	"email_origin" "email_origin" DEFAULT 'none' NOT NULL,
	"email_status" "email_status" DEFAULT 'not_checked' NOT NULL,
	"email_checked_at" timestamp with time zone,
	"email_provider_result" jsonb,
	"employment_status" "employment_status" DEFAULT 'unverified' NOT NULL,
	"employment_checked_at" timestamp with time zone,
	"source_published_at" date,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"discovered_by_run_id" uuid,
	"discovery_method" text DEFAULT 'manual' NOT NULL,
	"review_status" "review_status" DEFAULT 'new' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"rejected_reason" text,
	"eligibility_basis" "eligibility_basis" DEFAULT 'not_assessed' NOT NULL,
	"eligibility_evidence" text,
	"eligibility_evidence_url" text,
	"eligibility_scope" text,
	"eligibility_date" date,
	"eligibility_recorded_at" timestamp with time zone,
	"outreach_status" "outreach_status" DEFAULT 'not_contacted' NOT NULL,
	"last_contacted_at" timestamp with time zone,
	"last_reply_at" timestamp with time zone,
	"follow_up_at" timestamp with time zone,
	"previous_contact_id" uuid,
	"moved_to_contact_id" uuid,
	"conflicts" text,
	"quality" text DEFAULT 'needs_research' NOT NULL,
	"quality_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"complete" boolean DEFAULT false NOT NULL,
	"extracted_text" text,
	"extraction_status" "extraction_status" DEFAULT 'pending' NOT NULL,
	"extraction_error" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid,
	"title" text NOT NULL,
	"usage" "document_usage" DEFAULT 'internal' NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fetch_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"url" text NOT NULL,
	"host" text NOT NULL,
	"status" integer,
	"outcome" text NOT NULL,
	"bytes" integer,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_chunks" (
	"version_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"data" "bytea" NOT NULL,
	CONSTRAINT "file_chunks_version_id_idx_pk" PRIMARY KEY("version_id","idx")
);
--> statement-breakpoint
CREATE TABLE "google_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"refresh_token_enc" text,
	"access_token_enc" text,
	"access_token_expires_at" timestamp with time zone,
	"status" text DEFAULT 'connected' NOT NULL,
	"status_detail" text,
	"last_sync_at" timestamp with time zone,
	"last_sync_ok" boolean,
	"last_sync_error" text,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "host_state" (
	"host" text PRIMARY KEY NOT NULL,
	"robots_txt" text,
	"robots_status" integer,
	"robots_fetched_at" timestamp with time zone,
	"last_fetch_at" timestamp with time zone,
	"consecutive_errors" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gmail_message_id" text NOT NULL,
	"gmail_thread_id" text NOT NULL,
	"message_id" uuid,
	"contact_id" uuid,
	"from_email" text,
	"received_at" timestamp with time zone NOT NULL,
	"subject" text,
	"classification" "inbound_class" DEFAULT 'unknown' NOT NULL,
	"classified_by" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"trigger" text NOT NULL,
	"local_date" date,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"plan" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"error" text,
	"lease_owner" text,
	"lease_until" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"target_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"lease_until" timestamp with time zone,
	"result" jsonb,
	"error" text,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"name" text PRIMARY KEY NOT NULL,
	"holder" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"message_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "message_attachments_message_id_version_id_pk" PRIMARY KEY("message_id","version_id")
);
--> statement-breakpoint
CREATE TABLE "message_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"rev" integer NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"origin" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"program_id" uuid,
	"batch_id" uuid,
	"parent_message_id" uuid,
	"kind" text DEFAULT 'initial' NOT NULL,
	"language" "message_language" NOT NULL,
	"to_email" text,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"user_edited" boolean DEFAULT false NOT NULL,
	"generation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "message_status" DEFAULT 'draft' NOT NULL,
	"approval" jsonb,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"rfc_message_id" text,
	"gmail_message_id" text,
	"gmail_thread_id" text,
	"send_error" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid,
	"company_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"code_verifier" text NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "program_status" DEFAULT 'draft' NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary_source" text,
	"default_attachment_version_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"credits" double precision DEFAULT 0 NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"run_id" uuid,
	"task_id" uuid,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"message_id" uuid,
	"due_at" timestamp with time zone NOT NULL,
	"note" text,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"position" integer DEFAULT 100 NOT NULL,
	"built_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "send_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"response" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"reason" text,
	"source" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_sources" ADD CONSTRAINT "company_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_events" ADD CONSTRAINT "contact_events_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_evidence" ADD CONSTRAINT "contact_evidence_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_verifications" ADD CONSTRAINT "contact_verifications_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_tasks" ADD CONSTRAINT "job_tasks_run_id_job_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."job_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_version_id_document_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."document_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_revisions" ADD CONSTRAINT "message_revisions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "send_attempts" ADD CONSTRAINT "send_attempts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_events_open_idx" ON "app_events" USING btree ("resolved_at","level","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_slug_uq" ON "companies" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_domain_uq" ON "companies" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "companies_research_idx" ON "companies" USING btree ("research_status","next_research_at");--> statement-breakpoint
CREATE INDEX "companies_sector_idx" ON "companies" USING btree ("sector");--> statement-breakpoint
CREATE UNIQUE INDEX "company_sources_uq" ON "company_sources" USING btree ("company_id","url");--> statement-breakpoint
CREATE INDEX "contact_events_contact_idx" ON "contact_events" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE INDEX "contact_evidence_contact_idx" ON "contact_evidence" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "contact_verifications_contact_idx" ON "contact_verifications" USING btree ("contact_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_email_uq" ON "contacts" USING btree ("email_normalized") WHERE "contacts"."email_normalized" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_person_uq" ON "contacts" USING btree ("company_id","name_key") WHERE "contacts"."name_key" is not null;--> statement-breakpoint
CREATE INDEX "contacts_company_idx" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contacts_review_idx" ON "contacts" USING btree ("review_status","discovered_at");--> statement-breakpoint
CREATE INDEX "contacts_outreach_idx" ON "contacts" USING btree ("outreach_status");--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_uq" ON "document_versions" USING btree ("document_id","version");--> statement-breakpoint
CREATE INDEX "fetch_log_host_idx" ON "fetch_log" USING btree ("host","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_gmail_uq" ON "inbound_messages" USING btree ("gmail_message_id");--> statement-breakpoint
CREATE INDEX "inbound_contact_idx" ON "inbound_messages" USING btree ("contact_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_runs_scheduled_uq" ON "job_runs" USING btree ("kind","local_date") WHERE "job_runs"."trigger" in ('schedule','catch_up');--> statement-breakpoint
CREATE INDEX "job_runs_status_idx" ON "job_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_tasks_key_uq" ON "job_tasks" USING btree ("run_id","key");--> statement-breakpoint
CREATE INDEX "job_tasks_status_idx" ON "job_tasks" USING btree ("run_id","status");--> statement-breakpoint
CREATE INDEX "login_attempts_idx" ON "login_attempts" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_revisions_uq" ON "message_revisions" USING btree ("message_id","rev");--> statement-breakpoint
CREATE INDEX "messages_status_idx" ON "messages" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "messages_contact_idx" ON "messages" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_company_idx" ON "messages" USING btree ("company_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_rfc_uq" ON "messages" USING btree ("rfc_message_id") WHERE "messages"."rfc_message_id" is not null;--> statement-breakpoint
CREATE INDEX "notes_contact_idx" ON "notes" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "provider_usage_time_idx" ON "provider_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" USING btree ("done_at","due_at");--> statement-breakpoint
CREATE INDEX "send_attempts_message_idx" ON "send_attempts" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppressions_uq" ON "suppressions" USING btree ("kind","value");