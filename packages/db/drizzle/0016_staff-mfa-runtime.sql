CREATE TABLE "staff_login_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"failed_attempt_count" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp with time zone,
	CONSTRAINT "staff_login_challenges_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "staff_login_challenges_expires_after_created" CHECK ("staff_login_challenges"."expires_at" > "staff_login_challenges"."created_at"),
	CONSTRAINT "staff_login_challenges_failed_attempt_count_non_negative" CHECK ("staff_login_challenges"."failed_attempt_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "staff_login_challenges" ADD CONSTRAINT "staff_login_challenges_staff_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_login_challenges_staff_user_id_idx" ON "staff_login_challenges" USING btree ("staff_user_id");--> statement-breakpoint
CREATE INDEX "staff_login_challenges_expires_at_idx" ON "staff_login_challenges" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "staff_mfa_secrets" ADD COLUMN "last_verified_totp_step" bigint;--> statement-breakpoint
ALTER TABLE "staff_security_audit_events" DROP CONSTRAINT "staff_security_audit_events_type_check";--> statement-breakpoint
ALTER TABLE "staff_security_audit_events" ADD CONSTRAINT "staff_security_audit_events_type_check" CHECK ("staff_security_audit_events"."event_type" IN (
        'STAFF_SUSPENDED',
        'STAFF_REACTIVATED',
        'STAFF_ROLE_CHANGED',
        'STAFF_SCOPE_CHANGED',
        'STAFF_SESSION_REVOKED',
        'STAFF_SESSIONS_REVOKED_ALL',
        'STAFF_MFA_DISABLED',
        'STAFF_PASSWORD_RESET_REQUIRED',
        'MFA_ENROLLMENT_STARTED',
        'MFA_ENABLED',
        'MFA_RECOVERY_CODES_REGENERATED',
        'MFA_RECOVERY_CODE_USED',
        'MFA_LOGIN_SUCCEEDED',
        'MFA_CHALLENGE_LOCKED'
      ));
