CREATE TYPE "public"."tender_status" AS ENUM('new', 'saved', 'applied', 'dismissed');--> statement-breakpoint
CREATE TABLE "tenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'bk' NOT NULL,
	"external_id" text NOT NULL,
	"number" text,
	"title" text NOT NULL,
	"advertiser" text NOT NULL,
	"place" text,
	"snippet" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"published_on" date,
	"deadline_at" timestamp with time zone,
	"detail" jsonb,
	"detail_fetched_at" timestamp with time zone,
	"score" integer DEFAULT 0 NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "tender_status" DEFAULT 'new' NOT NULL,
	"status_at" timestamp with time zone,
	"note" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tenders_source_ext_uq" ON "tenders" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "tenders_list_idx" ON "tenders" USING btree ("status","score");