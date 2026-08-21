CREATE TABLE "homepage_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homepage_version_id" uuid,
	"event_type" text NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_staff_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"change_set" jsonb,
	CONSTRAINT "homepage_audit_events_type_check" CHECK ("homepage_audit_events"."event_type" IN ('HOMEPAGE_DRAFT_UPDATED', 'HOMEPAGE_PUBLISHED')),
	CONSTRAINT "homepage_audit_events_actor_kind_check" CHECK ("homepage_audit_events"."actor_kind" IN ('STAFF', 'SYSTEM')),
	CONSTRAINT "homepage_audit_events_actor_staff_required" CHECK ((
        ("homepage_audit_events"."actor_kind" = 'STAFF' AND "homepage_audit_events"."actor_staff_user_id" IS NOT NULL)
        OR
        ("homepage_audit_events"."actor_kind" = 'SYSTEM' AND "homepage_audit_events"."actor_staff_user_id" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "homepage_slots" (
	"homepage_version_id" uuid NOT NULL,
	"slot_key" text NOT NULL,
	"content_item_id" uuid,
	CONSTRAINT "homepage_slots_pk" PRIMARY KEY("homepage_version_id","slot_key"),
	CONSTRAINT "homepage_slots_slot_key_check" CHECK ("homepage_slots"."slot_key" IN (
        'LEAD',
        'SUPPORT_1',
        'SUPPORT_2',
        'FEATURED_1',
        'FEATURED_2',
        'FEATURED_3',
        'FEATURED_4',
        'FEATURED_5'
      ))
);
--> statement-breakpoint
CREATE TABLE "homepage_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"homepage_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_staff_user_id" uuid,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "homepages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"published_version_id" uuid,
	"draft_version_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homepages_singleton_id" CHECK ("homepages"."id" = '00000000-0000-4000-8000-000000000001'::uuid),
	CONSTRAINT "homepages_published_draft_distinct" CHECK ("homepages"."published_version_id" IS NULL
        OR "homepages"."draft_version_id" IS NULL
        OR "homepages"."published_version_id" IS DISTINCT FROM "homepages"."draft_version_id")
);
--> statement-breakpoint
ALTER TABLE "homepage_audit_events" ADD CONSTRAINT "homepage_audit_events_version_fk" FOREIGN KEY ("homepage_version_id") REFERENCES "public"."homepage_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_audit_events" ADD CONSTRAINT "homepage_audit_events_actor_staff_fk" FOREIGN KEY ("actor_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_slots" ADD CONSTRAINT "homepage_slots_version_fk" FOREIGN KEY ("homepage_version_id") REFERENCES "public"."homepage_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_slots" ADD CONSTRAINT "homepage_slots_content_item_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_versions" ADD CONSTRAINT "homepage_versions_homepage_fk" FOREIGN KEY ("homepage_id") REFERENCES "public"."homepages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_versions" ADD CONSTRAINT "homepage_versions_created_by_fk" FOREIGN KEY ("created_by_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepages" ADD CONSTRAINT "homepages_published_version_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."homepage_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepages" ADD CONSTRAINT "homepages_draft_version_fk" FOREIGN KEY ("draft_version_id") REFERENCES "public"."homepage_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homepage_audit_events_occurred_idx" ON "homepage_audit_events" USING btree ("occurred_at","id");--> statement-breakpoint
CREATE INDEX "homepage_slots_version_idx" ON "homepage_slots" USING btree ("homepage_version_id");--> statement-breakpoint
CREATE INDEX "homepage_slots_content_item_idx" ON "homepage_slots" USING btree ("content_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "homepage_slots_unique_content_item" ON "homepage_slots" USING btree ("homepage_version_id","content_item_id") WHERE "homepage_slots"."content_item_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "homepage_versions_homepage_idx" ON "homepage_versions" USING btree ("homepage_id","created_at");
