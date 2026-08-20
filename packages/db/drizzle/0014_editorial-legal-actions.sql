CREATE TYPE "public"."content_legal_action_type" AS ENUM('CORRECTION', 'CLARIFICATION', 'RETRACTION', 'TAKEDOWN', 'LEGAL_HOLD');--> statement-breakpoint
CREATE TYPE "public"."content_legal_action_polarity" AS ENUM('APPLY', 'RELEASE');--> statement-breakpoint
CREATE TYPE "public"."content_legal_reason_category" AS ENUM('FACTUAL_ERROR', 'CLARIFICATION', 'PRIVACY', 'DEFAMATION', 'COPYRIGHT', 'COURT_ORDER', 'REGULATORY', 'LEGAL_COMPLAINT', 'EDITORIAL_STANDARDS', 'SAFETY', 'OTHER');--> statement-breakpoint
CREATE TABLE "content_legal_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"content_version_id" uuid,
	"action_type" "content_legal_action_type" NOT NULL,
	"polarity" "content_legal_action_polarity" NOT NULL,
	"reason_category" "content_legal_reason_category" NOT NULL,
	"internal_note" text NOT NULL,
	"public_note" text,
	"actor_staff_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	CONSTRAINT "content_legal_actions_content_item_id_id_key" UNIQUE("content_item_id","id"),
	CONSTRAINT "content_legal_actions_internal_note_bounds" CHECK (char_length("content_legal_actions"."internal_note") BETWEEN 3 AND 4000),
	CONSTRAINT "content_legal_actions_public_note_bounds" CHECK ("content_legal_actions"."public_note" IS NULL OR char_length("content_legal_actions"."public_note") BETWEEN 1 AND 4000),
	CONSTRAINT "content_legal_actions_polarity_by_type" CHECK ((
        ("content_legal_actions"."action_type" = 'LEGAL_HOLD')
        OR
        ("content_legal_actions"."polarity" = 'APPLY')
      ))
);--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "legal_hold_action_id" uuid;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "retracted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "retracted_action_id" uuid;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "takedown_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "takedown_action_id" uuid;--> statement-breakpoint
ALTER TABLE "content_legal_actions" ADD CONSTRAINT "content_legal_actions_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_legal_actions" ADD CONSTRAINT "content_legal_actions_version_fk" FOREIGN KEY ("content_item_id","content_version_id") REFERENCES "public"."content_versions"("content_item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_legal_actions" ADD CONSTRAINT "content_legal_actions_actor_staff_fk" FOREIGN KEY ("actor_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_legal_hold_action_same_item_fk" FOREIGN KEY ("id","legal_hold_action_id") REFERENCES "public"."content_legal_actions"("content_item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_retracted_action_same_item_fk" FOREIGN KEY ("id","retracted_action_id") REFERENCES "public"."content_legal_actions"("content_item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_takedown_action_same_item_fk" FOREIGN KEY ("id","takedown_action_id") REFERENCES "public"."content_legal_actions"("content_item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_legal_actions_item_created_idx" ON "content_legal_actions" USING btree ("content_item_id","created_at","id");--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_legal_hold_state_coherent" CHECK ((
        ("content_items"."legal_hold_at" IS NULL AND "content_items"."legal_hold_reason" IS NULL AND "content_items"."legal_hold_action_id" IS NULL)
        OR
        ("content_items"."legal_hold_at" IS NOT NULL AND "content_items"."legal_hold_reason" IS NOT NULL AND "content_items"."legal_hold_action_id" IS NOT NULL)
      ));--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_legal_hold_reason_length" CHECK ("content_items"."legal_hold_reason" IS NULL OR char_length("content_items"."legal_hold_reason") BETWEEN 1 AND 64);--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_retracted_state_coherent" CHECK ((
        ("content_items"."retracted_at" IS NULL AND "content_items"."retracted_action_id" IS NULL)
        OR
        ("content_items"."retracted_at" IS NOT NULL AND "content_items"."retracted_action_id" IS NOT NULL)
      ));--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_takedown_state_coherent" CHECK ((
        ("content_items"."takedown_at" IS NULL AND "content_items"."takedown_action_id" IS NULL)
        OR
        ("content_items"."takedown_at" IS NOT NULL AND "content_items"."takedown_action_id" IS NOT NULL)
      ));--> statement-breakpoint
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
        'CONTENT_LEGAL_HOLD_RELEASED'
      ));
