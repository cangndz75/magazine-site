CREATE TABLE "redirect_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_path" text NOT NULL,
  "target_path" text NOT NULL,
  "status" text DEFAULT 'PERMANENT' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by_staff_user_id" uuid NOT NULL,
  "updated_by_staff_user_id" uuid NOT NULL,
  CONSTRAINT "redirect_rules_source_path_key" UNIQUE ("source_path"),
  CONSTRAINT "redirect_rules_status_check" CHECK ("status" = 'PERMANENT'),
  CONSTRAINT "redirect_rules_source_path_internal_check" CHECK (
    "source_path" ~ '^/[A-Za-z0-9._~!$&''()*+,;=:@%-]+(/[A-Za-z0-9._~!$&''()*+,;=:@%-]+)*$'
    AND "source_path" !~ '(^//|\\\\|://|[?#])'
    AND char_length("source_path") BETWEEN 2 AND 500
  ),
  CONSTRAINT "redirect_rules_target_path_internal_check" CHECK (
    "target_path" ~ '^/[A-Za-z0-9._~!$&''()*+,;=:@%-]+(/[A-Za-z0-9._~!$&''()*+,;=:@%-]+)*$'
    AND "target_path" !~ '(^//|\\\\|://|[?#])'
    AND char_length("target_path") BETWEEN 2 AND 500
  ),
  CONSTRAINT "redirect_rules_source_target_distinct" CHECK ("source_path" <> "target_path"),
  CONSTRAINT "redirect_rules_note_length" CHECK ("note" IS NULL OR char_length("note") BETWEEN 1 AND 500)
);
--> statement-breakpoint
ALTER TABLE "redirect_rules"
  ADD CONSTRAINT "redirect_rules_created_by_staff_user_id_fk"
  FOREIGN KEY ("created_by_staff_user_id")
  REFERENCES "public"."staff_users"("id")
  ON DELETE restrict
  ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "redirect_rules"
  ADD CONSTRAINT "redirect_rules_updated_by_staff_user_id_fk"
  FOREIGN KEY ("updated_by_staff_user_id")
  REFERENCES "public"."staff_users"("id")
  ON DELETE restrict
  ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "redirect_rules_enabled_source_path_idx"
  ON "redirect_rules" ("enabled", "source_path");
--> statement-breakpoint
CREATE TABLE "redirect_rule_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "redirect_rule_id" uuid NOT NULL,
  "actor_staff_user_id" uuid NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source_path" text NOT NULL,
  "old_target_path" text,
  "new_target_path" text,
  "old_enabled" boolean,
  "new_enabled" boolean,
  "change_set" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "redirect_rule_audit_events"
  ADD CONSTRAINT "redirect_rule_audit_events_redirect_rule_id_fk"
  FOREIGN KEY ("redirect_rule_id")
  REFERENCES "public"."redirect_rules"("id")
  ON DELETE restrict
  ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "redirect_rule_audit_events"
  ADD CONSTRAINT "redirect_rule_audit_events_actor_staff_user_id_fk"
  FOREIGN KEY ("actor_staff_user_id")
  REFERENCES "public"."staff_users"("id")
  ON DELETE restrict
  ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "redirect_rule_audit_events_rule_occurred_idx"
  ON "redirect_rule_audit_events" ("redirect_rule_id", "occurred_at");
