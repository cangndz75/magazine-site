CREATE TABLE "public_cache_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_cache_outbox_event_type_check" CHECK ("public_cache_outbox"."event_type" IN ('PUBLIC_ARTICLE_CACHE_INVALIDATE')),
	CONSTRAINT "public_cache_outbox_status_check" CHECK ("public_cache_outbox"."status" IN ('PENDING', 'PROCESSING', 'COMPLETED', 'DEAD')),
	CONSTRAINT "public_cache_outbox_attempt_count_non_negative" CHECK ("public_cache_outbox"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "public_cache_outbox_poll_idx" ON "public_cache_outbox" USING btree ("status","next_attempt_at","created_at","id");
