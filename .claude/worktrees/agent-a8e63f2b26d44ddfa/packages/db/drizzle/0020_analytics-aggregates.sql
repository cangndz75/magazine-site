CREATE TABLE "analytics_aggregation_checkpoints" (
	"job_name" text PRIMARY KEY NOT NULL,
	"last_successful_through" timestamp with time zone,
	"last_started_at" timestamp with time zone,
	"last_completed_at" timestamp with time zone,
	"last_error_safe_summary" text,
	"last_quality" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "analytics_aggregation_checkpoints_job_name_length" CHECK (char_length("analytics_aggregation_checkpoints"."job_name") BETWEEN 1 AND 100),
	CONSTRAINT "analytics_aggregation_checkpoints_error_length" CHECK ("analytics_aggregation_checkpoints"."last_error_safe_summary" IS NULL OR char_length("analytics_aggregation_checkpoints"."last_error_safe_summary") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE TABLE "analytics_author_daily" (
	"bucket_start" timestamp with time zone NOT NULL,
	"author_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"article_views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_author_daily_pk" PRIMARY KEY("bucket_start","author_id","content_item_id"),
	CONSTRAINT "analytics_author_daily_views_nonnegative" CHECK ("analytics_author_daily"."article_views" >= 0)
);
--> statement-breakpoint
CREATE TABLE "analytics_category_daily" (
	"bucket_start" timestamp with time zone NOT NULL,
	"primary_category_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"article_views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_category_daily_pk" PRIMARY KEY("bucket_start","primary_category_id","content_item_id"),
	CONSTRAINT "analytics_category_daily_views_nonnegative" CHECK ("analytics_category_daily"."article_views" >= 0)
);
--> statement-breakpoint
CREATE TABLE "analytics_content_daily" (
	"bucket_start" timestamp with time zone NOT NULL,
	"content_item_id" uuid NOT NULL,
	"published_version_id" uuid NOT NULL,
	"article_views" integer DEFAULT 0 NOT NULL,
	"gallery_opens" integer DEFAULT 0 NOT NULL,
	"gallery_image_views" integer DEFAULT 0 NOT NULL,
	"video_impressions" integer DEFAULT 0 NOT NULL,
	"homepage_impressions" integer DEFAULT 0 NOT NULL,
	"homepage_clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_content_daily_pk" PRIMARY KEY("bucket_start","content_item_id","published_version_id"),
	CONSTRAINT "analytics_content_daily_counts_nonnegative" CHECK ("analytics_content_daily"."article_views" >= 0 AND "analytics_content_daily"."gallery_opens" >= 0 AND "analytics_content_daily"."gallery_image_views" >= 0 AND "analytics_content_daily"."video_impressions" >= 0 AND "analytics_content_daily"."homepage_impressions" >= 0 AND "analytics_content_daily"."homepage_clicks" >= 0)
);
--> statement-breakpoint
CREATE TABLE "analytics_content_hourly" (
	"bucket_start" timestamp with time zone NOT NULL,
	"content_item_id" uuid NOT NULL,
	"published_version_id" uuid NOT NULL,
	"article_views" integer DEFAULT 0 NOT NULL,
	"gallery_opens" integer DEFAULT 0 NOT NULL,
	"gallery_image_views" integer DEFAULT 0 NOT NULL,
	"video_impressions" integer DEFAULT 0 NOT NULL,
	"homepage_impressions" integer DEFAULT 0 NOT NULL,
	"homepage_clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_content_hourly_pk" PRIMARY KEY("bucket_start","content_item_id","published_version_id"),
	CONSTRAINT "analytics_content_hourly_counts_nonnegative" CHECK ("analytics_content_hourly"."article_views" >= 0 AND "analytics_content_hourly"."gallery_opens" >= 0 AND "analytics_content_hourly"."gallery_image_views" >= 0 AND "analytics_content_hourly"."video_impressions" >= 0 AND "analytics_content_hourly"."homepage_impressions" >= 0 AND "analytics_content_hourly"."homepage_clicks" >= 0)
);
--> statement-breakpoint
CREATE TABLE "analytics_homepage_slot_daily" (
	"bucket_start" timestamp with time zone NOT NULL,
	"homepage_version_id" uuid,
	"placement" text NOT NULL,
	"position" integer NOT NULL,
	"content_item_id" uuid NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_homepage_slot_daily_uniq" UNIQUE NULLS NOT DISTINCT("bucket_start","homepage_version_id","placement","position","content_item_id"),
	CONSTRAINT "analytics_homepage_slot_daily_counts_nonnegative" CHECK ("analytics_homepage_slot_daily"."impressions" >= 0 AND "analytics_homepage_slot_daily"."clicks" >= 0)
);
--> statement-breakpoint
CREATE TABLE "analytics_homepage_slot_hourly" (
	"bucket_start" timestamp with time zone NOT NULL,
	"homepage_version_id" uuid,
	"placement" text NOT NULL,
	"position" integer NOT NULL,
	"content_item_id" uuid NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_homepage_slot_hourly_uniq" UNIQUE NULLS NOT DISTINCT("bucket_start","homepage_version_id","placement","position","content_item_id"),
	CONSTRAINT "analytics_homepage_slot_hourly_counts_nonnegative" CHECK ("analytics_homepage_slot_hourly"."impressions" >= 0 AND "analytics_homepage_slot_hourly"."clicks" >= 0)
);
--> statement-breakpoint
CREATE TABLE "analytics_media_daily" (
	"bucket_start" timestamp with time zone NOT NULL,
	"content_item_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"gallery_opens" integer DEFAULT 0 NOT NULL,
	"gallery_image_views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_media_daily_pk" PRIMARY KEY("bucket_start","content_item_id","media_id"),
	CONSTRAINT "analytics_media_daily_counts_nonnegative" CHECK ("analytics_media_daily"."gallery_opens" >= 0 AND "analytics_media_daily"."gallery_image_views" >= 0)
);
--> statement-breakpoint
CREATE TABLE "analytics_session_daily" (
	"bucket_start" timestamp with time zone NOT NULL,
	"anonymous_session_id" uuid NOT NULL,
	"content_item_id" uuid,
	CONSTRAINT "analytics_session_daily_uniq" UNIQUE NULLS NOT DISTINCT("bucket_start","anonymous_session_id","content_item_id")
);
--> statement-breakpoint
CREATE TABLE "analytics_source_daily" (
	"bucket_start" timestamp with time zone NOT NULL,
	"traffic_source" text NOT NULL,
	"referrer_host" text,
	"content_item_id" uuid,
	"event_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_source_daily_uniq" UNIQUE NULLS NOT DISTINCT("bucket_start","traffic_source","referrer_host","content_item_id"),
	CONSTRAINT "analytics_source_daily_count_nonnegative" CHECK ("analytics_source_daily"."event_count" >= 0),
	CONSTRAINT "analytics_source_daily_host_length" CHECK ("analytics_source_daily"."referrer_host" IS NULL OR char_length("analytics_source_daily"."referrer_host") BETWEEN 1 AND 253)
);
--> statement-breakpoint
CREATE TABLE "analytics_video_daily" (
	"bucket_start" timestamp with time zone NOT NULL,
	"video_asset_id" uuid NOT NULL,
	"surface" text NOT NULL,
	"content_item_id" uuid,
	"homepage_version_id" uuid,
	"impressions" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_video_daily_uniq" UNIQUE NULLS NOT DISTINCT("bucket_start","video_asset_id","surface","content_item_id","homepage_version_id"),
	CONSTRAINT "analytics_video_daily_impressions_nonnegative" CHECK ("analytics_video_daily"."impressions" >= 0)
);
--> statement-breakpoint
CREATE INDEX "analytics_author_daily_author_bucket_idx" ON "analytics_author_daily" USING btree ("author_id","bucket_start");
--> statement-breakpoint
CREATE INDEX "analytics_category_daily_category_bucket_idx" ON "analytics_category_daily" USING btree ("primary_category_id","bucket_start");
--> statement-breakpoint
CREATE INDEX "analytics_content_daily_content_bucket_idx" ON "analytics_content_daily" USING btree ("content_item_id","bucket_start");
--> statement-breakpoint
CREATE INDEX "analytics_content_daily_bucket_idx" ON "analytics_content_daily" USING btree ("bucket_start");
--> statement-breakpoint
CREATE INDEX "analytics_content_hourly_content_bucket_idx" ON "analytics_content_hourly" USING btree ("content_item_id","bucket_start");
--> statement-breakpoint
CREATE INDEX "analytics_content_hourly_bucket_idx" ON "analytics_content_hourly" USING btree ("bucket_start");
--> statement-breakpoint
CREATE INDEX "analytics_homepage_slot_daily_version_bucket_idx" ON "analytics_homepage_slot_daily" USING btree ("homepage_version_id","bucket_start");
--> statement-breakpoint
CREATE INDEX "analytics_homepage_slot_daily_content_bucket_idx" ON "analytics_homepage_slot_daily" USING btree ("content_item_id","bucket_start");
--> statement-breakpoint
CREATE INDEX "analytics_homepage_slot_hourly_version_bucket_idx" ON "analytics_homepage_slot_hourly" USING btree ("homepage_version_id","bucket_start");
--> statement-breakpoint
CREATE INDEX "analytics_homepage_slot_hourly_content_bucket_idx" ON "analytics_homepage_slot_hourly" USING btree ("content_item_id","bucket_start");
--> statement-breakpoint
CREATE INDEX "analytics_session_daily_bucket_idx" ON "analytics_session_daily" USING btree ("bucket_start");
--> statement-breakpoint
CREATE INDEX "analytics_source_daily_bucket_source_idx" ON "analytics_source_daily" USING btree ("bucket_start","traffic_source");
--> statement-breakpoint
CREATE INDEX "analytics_source_daily_content_bucket_idx" ON "analytics_source_daily" USING btree ("content_item_id","bucket_start");
