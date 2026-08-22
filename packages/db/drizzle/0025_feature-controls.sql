CREATE TABLE "feature_controls" (
  "key" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "enabled" boolean NOT NULL,
  "description" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by_staff_user_id" uuid,
  CONSTRAINT "feature_controls_type_check" CHECK ("type" IN ('FEATURE_FLAG', 'KILL_SWITCH')),
  CONSTRAINT "feature_controls_key_check" CHECK ("key" IN (
    'PUBLIC_SEARCH',
    'PUBLIC_GALLERIES',
    'EDITORIAL_CALENDAR',
    'ANALYTICS_INGESTION',
    'SCHEDULED_PUBLISHING',
    'PUBLIC_VIDEO',
    'HOMEPAGE_CONVERSATION'
  )),
  CONSTRAINT "feature_controls_key_type_check" CHECK (
    ("type" = 'FEATURE_FLAG' AND "key" IN ('PUBLIC_SEARCH', 'PUBLIC_GALLERIES', 'EDITORIAL_CALENDAR'))
    OR
    ("type" = 'KILL_SWITCH' AND "key" IN ('ANALYTICS_INGESTION', 'SCHEDULED_PUBLISHING', 'PUBLIC_VIDEO', 'HOMEPAGE_CONVERSATION'))
  ),
  CONSTRAINT "feature_controls_description_length" CHECK (char_length("description") BETWEEN 1 AND 500)
);
--> statement-breakpoint
ALTER TABLE "feature_controls"
  ADD CONSTRAINT "feature_controls_updated_by_staff_user_id_fk"
  FOREIGN KEY ("updated_by_staff_user_id")
  REFERENCES "public"."staff_users"("id")
  ON DELETE restrict
  ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "feature_control_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "control_key" text NOT NULL,
  "control_type" text NOT NULL,
  "actor_staff_user_id" uuid NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "old_enabled" boolean NOT NULL,
  "new_enabled" boolean NOT NULL,
  "old_description" text NOT NULL,
  "new_description" text NOT NULL,
  "change_set" jsonb NOT NULL,
  CONSTRAINT "feature_control_audit_events_type_check" CHECK ("control_type" IN ('FEATURE_FLAG', 'KILL_SWITCH')),
  CONSTRAINT "feature_control_audit_events_key_check" CHECK ("control_key" IN (
    'PUBLIC_SEARCH',
    'PUBLIC_GALLERIES',
    'EDITORIAL_CALENDAR',
    'ANALYTICS_INGESTION',
    'SCHEDULED_PUBLISHING',
    'PUBLIC_VIDEO',
    'HOMEPAGE_CONVERSATION'
  ))
);
--> statement-breakpoint
ALTER TABLE "feature_control_audit_events"
  ADD CONSTRAINT "feature_control_audit_events_control_key_fk"
  FOREIGN KEY ("control_key")
  REFERENCES "public"."feature_controls"("key")
  ON DELETE restrict
  ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "feature_control_audit_events"
  ADD CONSTRAINT "feature_control_audit_events_actor_staff_user_id_fk"
  FOREIGN KEY ("actor_staff_user_id")
  REFERENCES "public"."staff_users"("id")
  ON DELETE restrict
  ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "feature_control_audit_events_control_key_idx"
  ON "feature_control_audit_events" ("control_key", "occurred_at");
--> statement-breakpoint
INSERT INTO "feature_controls" ("key", "type", "enabled", "description") VALUES
  ('PUBLIC_SEARCH', 'FEATURE_FLAG', true, 'Controls public search result serving.'),
  ('PUBLIC_GALLERIES', 'FEATURE_FLAG', true, 'Controls public photo gallery serving.'),
  ('EDITORIAL_CALENDAR', 'FEATURE_FLAG', true, 'Controls the editorial calendar server surface.'),
  ('ANALYTICS_INGESTION', 'KILL_SWITCH', false, 'Stops public analytics ingestion when enabled.'),
  ('SCHEDULED_PUBLISHING', 'KILL_SWITCH', false, 'Stops scheduled publishing execution when enabled.'),
  ('PUBLIC_VIDEO', 'KILL_SWITCH', false, 'Hides public hosted video projections when enabled.'),
  ('HOMEPAGE_CONVERSATION', 'KILL_SWITCH', false, 'Hides the public homepage conversation rail when enabled.')
ON CONFLICT ("key") DO NOTHING;
