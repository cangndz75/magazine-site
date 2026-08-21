CREATE TYPE "public"."staff_mfa_factor_kind" AS ENUM('TOTP');--> statement-breakpoint
CREATE TYPE "public"."staff_mfa_factor_status" AS ENUM('PENDING', 'ACTIVE', 'DISABLED');--> statement-breakpoint
ALTER TABLE "staff_users" ADD COLUMN "password_reset_required_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "staff_mfa_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_user_id" uuid NOT NULL,
	"kind" "staff_mfa_factor_kind" NOT NULL,
	"status" "staff_mfa_factor_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"disabled_at" timestamp with time zone,
	CONSTRAINT "staff_mfa_factors_staff_user_id_key" UNIQUE("staff_user_id"),
	CONSTRAINT "staff_mfa_factors_active_confirmed" CHECK ((
        "staff_mfa_factors"."status" <> 'ACTIVE'
        OR "staff_mfa_factors"."confirmed_at" IS NOT NULL
      )),
	CONSTRAINT "staff_mfa_factors_disabled_at" CHECK ((
        ("staff_mfa_factors"."status" = 'DISABLED' AND "staff_mfa_factors"."disabled_at" IS NOT NULL)
        OR
        ("staff_mfa_factors"."status" <> 'DISABLED' AND "staff_mfa_factors"."disabled_at" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "staff_mfa_secrets" (
	"factor_id" uuid PRIMARY KEY NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_mfa_secrets_ciphertext_present" CHECK (char_length("staff_mfa_secrets"."secret_ciphertext") BETWEEN 1 AND 4096)
);
--> statement-breakpoint
CREATE TABLE "staff_mfa_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factor_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "staff_mfa_recovery_codes_code_hash_key" UNIQUE("code_hash"),
	CONSTRAINT "staff_mfa_recovery_codes_hash_present" CHECK (char_length("staff_mfa_recovery_codes"."code_hash") BETWEEN 16 AND 255)
);
--> statement-breakpoint
CREATE TABLE "staff_security_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_staff_user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_staff_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"change_set" jsonb,
	CONSTRAINT "staff_security_audit_events_type_check" CHECK ("staff_security_audit_events"."event_type" IN (
        'STAFF_SUSPENDED',
        'STAFF_REACTIVATED',
        'STAFF_ROLE_CHANGED',
        'STAFF_SCOPE_CHANGED',
        'STAFF_SESSION_REVOKED',
        'STAFF_SESSIONS_REVOKED_ALL',
        'STAFF_MFA_DISABLED',
        'STAFF_PASSWORD_RESET_REQUIRED'
      )),
	CONSTRAINT "staff_security_audit_events_actor_kind_check" CHECK ("staff_security_audit_events"."actor_kind" IN ('STAFF', 'SYSTEM')),
	CONSTRAINT "staff_security_audit_events_actor_staff_required" CHECK ((
        ("staff_security_audit_events"."actor_kind" = 'STAFF' AND "staff_security_audit_events"."actor_staff_user_id" IS NOT NULL)
        OR
        ("staff_security_audit_events"."actor_kind" = 'SYSTEM' AND "staff_security_audit_events"."actor_staff_user_id" IS NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "staff_mfa_factors" ADD CONSTRAINT "staff_mfa_factors_staff_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_mfa_secrets" ADD CONSTRAINT "staff_mfa_secrets_factor_id_fk" FOREIGN KEY ("factor_id") REFERENCES "public"."staff_mfa_factors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_mfa_recovery_codes" ADD CONSTRAINT "staff_mfa_recovery_codes_factor_id_fk" FOREIGN KEY ("factor_id") REFERENCES "public"."staff_mfa_factors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_security_audit_events" ADD CONSTRAINT "staff_security_audit_events_subject_fk" FOREIGN KEY ("subject_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_security_audit_events" ADD CONSTRAINT "staff_security_audit_events_actor_staff_fk" FOREIGN KEY ("actor_staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_mfa_recovery_codes_factor_id_idx" ON "staff_mfa_recovery_codes" USING btree ("factor_id");--> statement-breakpoint
CREATE INDEX "staff_security_audit_events_subject_occurred_idx" ON "staff_security_audit_events" USING btree ("subject_staff_user_id","occurred_at","id");
