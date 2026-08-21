CREATE TABLE "content_slug_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"old_slug" text NOT NULL,
	"actor_staff_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_slug_history_old_slug_key" UNIQUE("old_slug"),
	CONSTRAINT "content_slug_history_item_old_slug_key" UNIQUE("content_item_id","old_slug"),
	CONSTRAINT "content_slug_history_old_slug_format" CHECK ("content_slug_history"."old_slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("content_slug_history"."old_slug") BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "content_slug_history" ADD CONSTRAINT "content_slug_history_item_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_slug_history" ADD CONSTRAINT "content_slug_history_actor_staff_fk" FOREIGN KEY ("actor_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_slug_history_item_created_idx" ON "content_slug_history" USING btree ("content_item_id","created_at","id");--> statement-breakpoint
ALTER TABLE "content_audit_events" DROP CONSTRAINT "content_audit_events_type_check";--> statement-breakpoint
ALTER TABLE "content_audit_events" ADD CONSTRAINT "content_audit_events_type_check" CHECK ("content_audit_events"."event_type" IN (
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
        'CONTENT_SCHEDULE_CANCELLED',
        'CONTENT_CORRECTION_RECORDED',
        'CONTENT_CLARIFICATION_RECORDED',
        'CONTENT_RETRACTED',
        'CONTENT_TAKEN_DOWN',
        'CONTENT_LEGAL_HOLD_PLACED',
        'CONTENT_LEGAL_HOLD_RELEASED',
        'CONTENT_SLUG_CHANGED'
      ));--> statement-breakpoint
CREATE OR REPLACE FUNCTION content_slug_not_foreign_history() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM content_slug_history
    WHERE old_slug = NEW.slug
      AND content_item_id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'SLUG_CONFLICT'
      USING ERRCODE = '23505',
            CONSTRAINT = 'content_items_slug_key';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER content_items_slug_not_foreign_history
BEFORE INSERT OR UPDATE OF slug ON content_items
FOR EACH ROW EXECUTE FUNCTION content_slug_not_foreign_history();--> statement-breakpoint
CREATE OR REPLACE FUNCTION content_history_slug_not_foreign_current() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM content_items
    WHERE slug = NEW.old_slug
      AND id <> NEW.content_item_id
  ) THEN
    RAISE EXCEPTION 'SLUG_CONFLICT'
      USING ERRCODE = '23505',
            CONSTRAINT = 'content_slug_history_old_slug_key';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER content_slug_history_not_foreign_current
BEFORE INSERT OR UPDATE OF old_slug ON content_slug_history
FOR EACH ROW EXECUTE FUNCTION content_history_slug_not_foreign_current();
