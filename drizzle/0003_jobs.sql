CREATE TYPE "public"."job_offer_status" AS ENUM('new', 'saved', 'applied', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."job_source_kind" AS ENUM('greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'recruitee', 'personio', 'teamtailor', 'eightfold', 'workday', 'successfactors', 'arbeitnow', 'himalayas', 'adzuna', 'jooble', 'manual');--> statement-breakpoint
CREATE TABLE "job_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"company_id" uuid,
	"company_name" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"workplace" text DEFAULT 'unknown' NOT NULL,
	"employment_type" text,
	"department" text,
	"description" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"posted_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"score" integer DEFAULT 0 NOT NULL,
	"match" jsonb DEFAULT '{"reasons":[],"region":"unknown","requiredLanguages":[],"hits":[]}'::jsonb NOT NULL,
	"status" "job_offer_status" DEFAULT 'new' NOT NULL,
	"status_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "job_source_kind" NOT NULL,
	"token" text NOT NULL,
	"name" text NOT NULL,
	"company_id" uuid,
	"url" text,
	"supported" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"next_fetch_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"jobs_total" integer DEFAULT 0 NOT NULL,
	"jobs_kept" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "favourite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "careers_url" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "careers_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_sources" ADD CONSTRAINT "job_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_offers_source_ext_uq" ON "job_offers" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "job_offers_list_idx" ON "job_offers" USING btree ("status","score");--> statement-breakpoint
CREATE INDEX "job_offers_company_idx" ON "job_offers" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_sources_kind_token_uq" ON "job_sources" USING btree ("kind","token");--> statement-breakpoint
CREATE INDEX "job_sources_due_idx" ON "job_sources" USING btree ("next_fetch_at");