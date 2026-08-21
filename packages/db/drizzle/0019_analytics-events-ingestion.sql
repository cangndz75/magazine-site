ALTER TABLE "analytics_events" ADD COLUMN "position" integer;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "media_id" uuid;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "video_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "primary_category_id" uuid;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "author_ids" uuid[];--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "fact_fingerprint" text;--> statement-breakpoint
UPDATE "analytics_events" SET "fact_fingerprint" = repeat('0', 64) WHERE "fact_fingerprint" IS NULL;--> statement-breakpoint
ALTER TABLE "analytics_events" ALTER COLUMN "fact_fingerprint" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_fact_fingerprint_length" CHECK (char_length("fact_fingerprint") = 64);--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_author_ids_bounds" CHECK ("author_ids" IS NULL OR (cardinality("author_ids") BETWEEN 1 AND 8));--> statement-breakpoint
CREATE INDEX "analytics_events_received_at_idx" ON "analytics_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "analytics_events_occurred_at_idx" ON "analytics_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_published_occurred_idx" ON "analytics_events" USING btree ("published_version_id","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_homepage_occurred_idx" ON "analytics_events" USING btree ("homepage_version_id","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_traffic_occurred_idx" ON "analytics_events" USING btree ("traffic_kind","occurred_at");
