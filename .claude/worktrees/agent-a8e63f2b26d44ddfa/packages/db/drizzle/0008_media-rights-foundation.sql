CREATE TYPE "public"."media_license_type" AS ENUM('UNKNOWN', 'ALL_RIGHTS', 'COMMISSIONED', 'EDITORIAL', 'CREATIVE_COMMONS', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."media_source_kind" AS ENUM('UNKNOWN', 'OWNED', 'COMMISSIONED', 'LICENSED', 'AGENCY', 'UGC');--> statement-breakpoint
CREATE TYPE "public"."media_usage_restriction" AS ENUM('NONE', 'EDITORIAL_ONLY', 'RESTRICTED');--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "source_kind" "media_source_kind" DEFAULT 'UNKNOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "source_name" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "creator_name" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "rights_holder" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "license_type" "media_license_type" DEFAULT 'UNKNOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "license_reference" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "license_note" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "license_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "license_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "credit_line" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "usage_restriction" "media_usage_restriction" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "territory_restriction" text;--> statement-breakpoint
CREATE INDEX "media_license_expires_at_idx" ON "media" USING btree ("license_expires_at") WHERE "media"."license_expires_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_license_window_valid" CHECK ("media"."license_expires_at" IS NULL
        OR "media"."license_starts_at" IS NULL
        OR "media"."license_expires_at" > "media"."license_starts_at");--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_source_name_length" CHECK ("media"."source_name" IS NULL OR char_length("media"."source_name") BETWEEN 1 AND 200);--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_creator_name_length" CHECK ("media"."creator_name" IS NULL OR char_length("media"."creator_name") BETWEEN 1 AND 200);--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_rights_holder_length" CHECK ("media"."rights_holder" IS NULL OR char_length("media"."rights_holder") BETWEEN 1 AND 200);--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_license_reference_length" CHECK ("media"."license_reference" IS NULL OR char_length("media"."license_reference") BETWEEN 1 AND 200);--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_license_note_length" CHECK ("media"."license_note" IS NULL OR char_length("media"."license_note") BETWEEN 1 AND 4000);--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_credit_line_length" CHECK ("media"."credit_line" IS NULL OR char_length("media"."credit_line") BETWEEN 1 AND 200);--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_territory_restriction_length" CHECK ("media"."territory_restriction" IS NULL OR char_length("media"."territory_restriction") BETWEEN 1 AND 200);