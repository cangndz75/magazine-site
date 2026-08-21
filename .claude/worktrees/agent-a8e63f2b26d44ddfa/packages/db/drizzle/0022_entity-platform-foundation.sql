CREATE TYPE "public"."entity_status" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "entity_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_staff_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"change_set" jsonb,
	CONSTRAINT "entity_audit_events_type_check" CHECK ("entity_audit_events"."event_type" IN (
        'ENTITY_CREATED',
        'ENTITY_UPDATED',
        'ENTITY_SLUG_CHANGED',
        'ENTITY_ARCHIVED',
        'ENTITY_REACTIVATED'
      )),
	CONSTRAINT "entity_audit_events_actor_kind_check" CHECK ("entity_audit_events"."actor_kind" IN ('STAFF', 'SYSTEM')),
	CONSTRAINT "entity_audit_events_actor_staff_required" CHECK ((
        ("entity_audit_events"."actor_kind" = 'STAFF' AND "entity_audit_events"."actor_staff_user_id" IS NOT NULL)
        OR
        ("entity_audit_events"."actor_kind" = 'SYSTEM' AND "entity_audit_events"."actor_staff_user_id" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "entity_slug_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"old_slug" text NOT NULL,
	"actor_staff_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_slug_history_old_slug_key" UNIQUE("old_slug"),
	CONSTRAINT "entity_slug_history_entity_old_slug_key" UNIQUE("entity_id","old_slug"),
	CONSTRAINT "entity_slug_history_old_slug_format" CHECK ("entity_slug_history"."old_slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("entity_slug_history"."old_slug") BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "status" "entity_status" DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "biography" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "portrait_media_id" uuid;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "occupation" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "official_website_url" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "merged_into_entity_id" uuid;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "entities" SET "status" = 'ARCHIVED' WHERE "is_active" = false;--> statement-breakpoint
UPDATE "entities" SET "description" = NULL WHERE "description" IS NOT NULL AND char_length(btrim("description")) = 0;--> statement-breakpoint
ALTER TABLE "entity_audit_events" ADD CONSTRAINT "entity_audit_events_entity_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_audit_events" ADD CONSTRAINT "entity_audit_events_actor_staff_fk" FOREIGN KEY ("actor_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_slug_history" ADD CONSTRAINT "entity_slug_history_entity_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_slug_history" ADD CONSTRAINT "entity_slug_history_actor_staff_fk" FOREIGN KEY ("actor_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entity_audit_events_entity_occurred_idx" ON "entity_audit_events" USING btree ("entity_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "entity_slug_history_entity_created_idx" ON "entity_slug_history" USING btree ("entity_id","created_at","id");--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_portrait_media_fk" FOREIGN KEY ("portrait_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_merged_into_entity_fk" FOREIGN KEY ("merged_into_entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_version_entities_entity_idx" ON "content_version_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entities_status_kind_idx" ON "entities" USING btree ("status","kind");--> statement-breakpoint
CREATE INDEX "entities_status_updated_idx" ON "entities" USING btree ("status","updated_at","id");--> statement-breakpoint
CREATE INDEX "entity_aliases_normalized_alias_idx" ON "entity_aliases" USING btree ("normalized_alias");--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_canonical_name_length" CHECK (char_length("entities"."canonical_name") BETWEEN 1 AND 200);--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_summary_length" CHECK ("entities"."description" IS NULL OR char_length("entities"."description") BETWEEN 1 AND 500);--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_biography_length" CHECK ("entities"."biography" IS NULL OR char_length("entities"."biography") BETWEEN 1 AND 4000);--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_occupation_length" CHECK ("entities"."occupation" IS NULL OR char_length("entities"."occupation") BETWEEN 1 AND 200);--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_person_only_profile_fields" CHECK ("entities"."kind" = 'PERSON' OR ("entities"."birth_date" IS NULL AND "entities"."occupation" IS NULL));--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_merged_into_not_self" CHECK ("entities"."merged_into_entity_id" IS NULL OR "entities"."merged_into_entity_id" <> "entities"."id");--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_status_matches_is_active" CHECK (("entities"."is_active" AND "entities"."status" = 'ACTIVE') OR (NOT "entities"."is_active" AND "entities"."status" <> 'ACTIVE'));--> statement-breakpoint
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_alias_length" CHECK (char_length("entity_aliases"."alias") BETWEEN 1 AND 200);