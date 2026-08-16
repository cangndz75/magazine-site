CREATE TYPE "public"."staff_role" AS ENUM('SUPER_ADMIN', 'EDITOR', 'AUTHOR');--> statement-breakpoint
CREATE TYPE "public"."staff_scope_mode" AS ENUM('ALL', 'SELECTED');--> statement-breakpoint
CREATE TYPE "public"."staff_status" AS ENUM('ACTIVE', 'DISABLED');--> statement-breakpoint
CREATE TABLE "staff_password_credentials" (
	"staff_user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"last_failed_login_at" timestamp with time zone,
	"locked_until" timestamp with time zone,
	CONSTRAINT "staff_password_credentials_failed_login_count_non_negative" CHECK ("staff_password_credentials"."failed_login_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "staff_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "staff_sessions_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "staff_sessions_expires_after_created" CHECK ("staff_sessions"."expires_at" > "staff_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "staff_user_category_scopes" (
	"staff_user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "staff_user_category_scopes_pk" PRIMARY KEY("staff_user_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "staff_user_roles" (
	"staff_user_id" uuid NOT NULL,
	"role" "staff_role" NOT NULL,
	CONSTRAINT "staff_user_roles_pk" PRIMARY KEY("staff_user_id","role")
);
--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"status" "staff_status" DEFAULT 'ACTIVE' NOT NULL,
	"scope_mode" "staff_scope_mode" DEFAULT 'ALL' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	CONSTRAINT "staff_users_email_key" UNIQUE("email"),
	CONSTRAINT "staff_users_email_canonical" CHECK ("staff_users"."email" = lower("staff_users"."email") AND "staff_users"."email" = btrim("staff_users"."email") AND char_length("staff_users"."email") BETWEEN 3 AND 254),
	CONSTRAINT "staff_users_display_name_length" CHECK (char_length("staff_users"."display_name") BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "staff_password_credentials" ADD CONSTRAINT "staff_password_credentials_staff_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user_category_scopes" ADD CONSTRAINT "staff_user_category_scopes_staff_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user_category_scopes" ADD CONSTRAINT "staff_user_category_scopes_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_user_roles" ADD CONSTRAINT "staff_user_roles_staff_user_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_sessions_staff_user_id_idx" ON "staff_sessions" USING btree ("staff_user_id");--> statement-breakpoint
CREATE INDEX "staff_sessions_expires_at_idx" ON "staff_sessions" USING btree ("expires_at");