CREATE TYPE "public"."event_status" AS ENUM('new', 'saved', 'going', 'dismissed');--> statement-breakpoint
CREATE TABLE "event_sources" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"kind" text NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"events_found" integer DEFAULT 0 NOT NULL,
	"lines" jsonb,
	"lines_hash" text,
	"new_lines" jsonb,
	"changed_at" timestamp with time zone,
	"seen_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"organiser" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"place" text,
	"online" boolean DEFAULT false NOT NULL,
	"url" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" text,
	"score" integer DEFAULT 0 NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "event_status" DEFAULT 'new' NOT NULL,
	"status_at" timestamp with time zone,
	"note" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "events_source_ext_uq" ON "events" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "events_starts_idx" ON "events" USING btree ("starts_at");