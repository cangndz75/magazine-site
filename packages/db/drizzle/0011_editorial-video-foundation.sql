CREATE TYPE "public"."video_provider" AS ENUM('YOUTUBE', 'VIMEO');--> statement-breakpoint
CREATE TABLE "editorial_video_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" "video_provider" NOT NULL,
  "provider_video_id" text NOT NULL,
  "canonical_url" text NOT NULL,
  "submitted_url" text NOT NULL,
  "title" text NOT NULL,
  "caption" text,
  "description" text,
  "duration_seconds" integer,
  "poster_media_id" uuid,
  "rights_note" text,
  "provenance" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "editorial_video_assets_provider_video_key" UNIQUE("provider","provider_video_id"),
  CONSTRAINT "editorial_video_assets_provider_video_id_length" CHECK (char_length("editorial_video_assets"."provider_video_id") BETWEEN 6 AND 64),
  CONSTRAINT "editorial_video_assets_canonical_url_length" CHECK (char_length("editorial_video_assets"."canonical_url") BETWEEN 1 AND 500),
  CONSTRAINT "editorial_video_assets_submitted_url_length" CHECK (char_length("editorial_video_assets"."submitted_url") BETWEEN 1 AND 500),
  CONSTRAINT "editorial_video_assets_title_length" CHECK (char_length("editorial_video_assets"."title") BETWEEN 1 AND 200),
  CONSTRAINT "editorial_video_assets_caption_length" CHECK ("editorial_video_assets"."caption" IS NULL OR char_length("editorial_video_assets"."caption") BETWEEN 1 AND 1000),
  CONSTRAINT "editorial_video_assets_description_length" CHECK ("editorial_video_assets"."description" IS NULL OR char_length("editorial_video_assets"."description") BETWEEN 1 AND 4000),
  CONSTRAINT "editorial_video_assets_duration_bounds" CHECK ("editorial_video_assets"."duration_seconds" IS NULL OR ("editorial_video_assets"."duration_seconds" > 0 AND "editorial_video_assets"."duration_seconds" <= 86400)),
  CONSTRAINT "editorial_video_assets_rights_note_length" CHECK ("editorial_video_assets"."rights_note" IS NULL OR char_length("editorial_video_assets"."rights_note") BETWEEN 1 AND 4000),
  CONSTRAINT "editorial_video_assets_provenance_length" CHECK ("editorial_video_assets"."provenance" IS NULL OR char_length("editorial_video_assets"."provenance") BETWEEN 1 AND 1000)
);--> statement-breakpoint
CREATE TABLE "content_version_videos" (
  "content_version_id" uuid NOT NULL,
  "video_asset_id" uuid NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "caption" text,
  CONSTRAINT "content_version_videos_pk" PRIMARY KEY("content_version_id","video_asset_id"),
  CONSTRAINT "content_version_videos_sort_order_non_negative" CHECK ("content_version_videos"."sort_order" >= 0),
  CONSTRAINT "content_version_videos_caption_length" CHECK ("content_version_videos"."caption" IS NULL OR char_length("content_version_videos"."caption") BETWEEN 1 AND 1000)
);--> statement-breakpoint
ALTER TABLE "editorial_video_assets" ADD CONSTRAINT "editorial_video_assets_poster_media_id_media_id_fk" FOREIGN KEY ("poster_media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version_videos" ADD CONSTRAINT "content_version_videos_version_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version_videos" ADD CONSTRAINT "content_version_videos_asset_fk" FOREIGN KEY ("video_asset_id") REFERENCES "public"."editorial_video_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "editorial_video_assets_poster_media_id_idx" ON "editorial_video_assets" USING btree ("poster_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_version_videos_sort_order" ON "content_version_videos" USING btree ("content_version_id","sort_order");
