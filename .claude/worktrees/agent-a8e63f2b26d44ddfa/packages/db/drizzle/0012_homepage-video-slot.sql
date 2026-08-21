CREATE TABLE "homepage_version_videos" (
	"homepage_version_id" uuid PRIMARY KEY NOT NULL,
	"video_asset_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "homepage_version_videos" ADD CONSTRAINT "homepage_version_videos_version_fk" FOREIGN KEY ("homepage_version_id") REFERENCES "public"."homepage_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homepage_version_videos" ADD CONSTRAINT "homepage_version_videos_asset_fk" FOREIGN KEY ("video_asset_id") REFERENCES "public"."editorial_video_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homepage_version_videos_asset_idx" ON "homepage_version_videos" USING btree ("video_asset_id");
