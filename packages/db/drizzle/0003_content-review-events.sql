CREATE TYPE "public"."review_event_type" AS ENUM('SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED');--> statement-breakpoint
CREATE TABLE "content_review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"content_version_id" uuid NOT NULL,
	"event_type" "review_event_type" NOT NULL,
	"actor_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_review_events_note_bounds" CHECK ((
        ("content_review_events"."event_type" = 'CHANGES_REQUESTED' AND "content_review_events"."note" IS NOT NULL
          AND char_length("content_review_events"."note") BETWEEN 3 AND 4000)
        OR
        ("content_review_events"."event_type" <> 'CHANGES_REQUESTED' AND (
          "content_review_events"."note" IS NULL
          OR char_length("content_review_events"."note") BETWEEN 3 AND 4000
        ))
      ))
);
--> statement-breakpoint
ALTER TABLE "content_review_events" ADD CONSTRAINT "content_review_events_item_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_review_events" ADD CONSTRAINT "content_review_events_version_fk" FOREIGN KEY ("content_item_id","content_version_id") REFERENCES "public"."content_versions"("content_item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_review_events" ADD CONSTRAINT "content_review_events_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_review_events_version_type_created_idx" ON "content_review_events" USING btree ("content_version_id","event_type","created_at");--> statement-breakpoint
CREATE INDEX "content_review_events_item_created_idx" ON "content_review_events" USING btree ("content_item_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "content_versions_one_in_review" ON "content_versions" USING btree ("content_item_id") WHERE "content_versions"."workflow_status" = 'IN_REVIEW';