CREATE TABLE "newsletter_subscribers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "suppressed" boolean DEFAULT false NOT NULL,
  "suppression_reason" text,
  "source" text NOT NULL,
  "consent_version" text,
  "surface" text,
  "confirmation_token_hash" text,
  "confirmation_token_expires_at" timestamp with time zone,
  "confirmation_token_consumed_at" timestamp with time zone,
  "unsubscribe_token_hash" text NOT NULL,
  "unsubscribe_token_expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "confirmed_at" timestamp with time zone,
  "unsubscribed_at" timestamp with time zone,
  CONSTRAINT "newsletter_subscribers_email_key" UNIQUE ("email"),
  CONSTRAINT "newsletter_subscribers_email_check" CHECK (
    char_length("email") BETWEEN 3 AND 254
    AND "email" = lower(trim("email"))
    AND "email" ~ '^[A-Za-z0-9.!#$%&''''*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$'
  ),
  CONSTRAINT "newsletter_subscribers_status_check" CHECK ("status" IN ('PENDING', 'ACTIVE', 'UNSUBSCRIBED')),
  CONSTRAINT "newsletter_subscribers_suppression_reason_check" CHECK (
    "suppression_reason" IS NULL OR "suppression_reason" IN ('UNSUBSCRIBED', 'HARD_BOUNCE', 'COMPLAINT', 'ADMIN_BLOCK')
  ),
  CONSTRAINT "newsletter_subscribers_suppression_consistency" CHECK (
    ("suppressed" = false AND "suppression_reason" IS NULL)
    OR ("suppressed" = true AND "suppression_reason" IS NOT NULL)
  ),
  CONSTRAINT "newsletter_subscribers_confirmation_token_pair" CHECK (
    ("confirmation_token_hash" IS NULL AND "confirmation_token_expires_at" IS NULL)
    OR ("confirmation_token_hash" IS NOT NULL AND "confirmation_token_expires_at" IS NOT NULL)
  ),
  CONSTRAINT "newsletter_subscribers_source_length" CHECK (char_length("source") BETWEEN 1 AND 64),
  CONSTRAINT "newsletter_subscribers_consent_version_length" CHECK ("consent_version" IS NULL OR char_length("consent_version") BETWEEN 1 AND 64),
  CONSTRAINT "newsletter_subscribers_surface_length" CHECK ("surface" IS NULL OR char_length("surface") BETWEEN 1 AND 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_subscribers_confirmation_token_hash_key"
  ON "newsletter_subscribers" ("confirmation_token_hash")
  WHERE "confirmation_token_hash" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_token_hash_key"
  ON "newsletter_subscribers" ("unsubscribe_token_hash");
--> statement-breakpoint
CREATE INDEX "newsletter_subscribers_status_created_idx"
  ON "newsletter_subscribers" ("status", "created_at", "id");
--> statement-breakpoint
CREATE INDEX "newsletter_subscribers_eligible_idx"
  ON "newsletter_subscribers" ("created_at", "id")
  WHERE "status" = 'ACTIVE' AND "suppressed" = false AND "suppression_reason" IS NULL;
--> statement-breakpoint
CREATE TABLE "newsletter_consent_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscriber_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "actor_kind" text DEFAULT 'PUBLIC' NOT NULL,
  "actor_staff_user_id" uuid,
  "email" text NOT NULL,
  "source" text NOT NULL,
  "consent_version" text,
  "surface" text,
  "change_set" jsonb NOT NULL,
  CONSTRAINT "newsletter_consent_events_type_check" CHECK ("event_type" IN ('SUBSCRIBE_REQUESTED', 'CONFIRMED', 'UNSUBSCRIBED', 'RESUBSCRIBE_REQUESTED', 'ADMIN_SUPPRESSED')),
  CONSTRAINT "newsletter_consent_events_actor_kind_check" CHECK ("actor_kind" IN ('PUBLIC', 'STAFF', 'SYSTEM')),
  CONSTRAINT "newsletter_consent_events_actor_staff_required" CHECK (
    ("actor_kind" = 'STAFF' AND "actor_staff_user_id" IS NOT NULL)
    OR ("actor_kind" IN ('PUBLIC', 'SYSTEM') AND "actor_staff_user_id" IS NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "newsletter_consent_events"
  ADD CONSTRAINT "newsletter_consent_events_subscriber_fk"
  FOREIGN KEY ("subscriber_id")
  REFERENCES "public"."newsletter_subscribers"("id")
  ON DELETE restrict
  ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "newsletter_consent_events"
  ADD CONSTRAINT "newsletter_consent_events_actor_staff_fk"
  FOREIGN KEY ("actor_staff_user_id")
  REFERENCES "public"."staff_users"("id")
  ON DELETE restrict
  ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "newsletter_consent_events_subscriber_occurred_idx"
  ON "newsletter_consent_events" ("subscriber_id", "occurred_at", "id");
