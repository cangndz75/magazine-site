CREATE TABLE "content_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"content_version_id" uuid,
	"event_type" text NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_staff_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"change_set" jsonb,
	CONSTRAINT "content_audit_events_type_check" CHECK ("content_audit_events"."event_type" IN (
        'CONTENT_CREATED',
        'DRAFT_REVISION_CREATED',
        'DRAFT_UPDATED',
        'REVIEW_SUBMITTED',
        'REVIEW_CHANGES_REQUESTED',
        'REVIEW_APPROVED',
        'CONTENT_PUBLISHED',
        'CONTENT_UNPUBLISHED',
        'CONTENT_SCHEDULED',
        'CONTENT_RESCHEDULED',
        'CONTENT_SCHEDULE_CANCELLED'
      )),
	CONSTRAINT "content_audit_events_actor_kind_check" CHECK ("content_audit_events"."actor_kind" IN ('STAFF', 'SYSTEM')),
	CONSTRAINT "content_audit_events_actor_staff_required" CHECK ((
        ("content_audit_events"."actor_kind" = 'STAFF' AND "content_audit_events"."actor_staff_user_id" IS NOT NULL)
        OR
        ("content_audit_events"."actor_kind" = 'SYSTEM' AND "content_audit_events"."actor_staff_user_id" IS NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "content_audit_events" ADD CONSTRAINT "content_audit_events_item_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_audit_events" ADD CONSTRAINT "content_audit_events_version_fk" FOREIGN KEY ("content_item_id","content_version_id") REFERENCES "public"."content_versions"("content_item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_audit_events" ADD CONSTRAINT "content_audit_events_actor_staff_fk" FOREIGN KEY ("actor_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_audit_events_item_occurred_idx" ON "content_audit_events" USING btree ("content_item_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "content_audit_events_version_idx" ON "content_audit_events" USING btree ("content_version_id");
