WITH ranked AS (
  SELECT
    "content_version_id",
    "media_id",
    "role",
    (ROW_NUMBER() OVER (
      PARTITION BY "content_version_id"
      ORDER BY "sort_order" ASC, "media_id" ASC
    ) - 1) AS "next_order"
  FROM "content_version_media"
  WHERE "role" = 'GALLERY'
)
UPDATE "content_version_media" AS "target"
SET "sort_order" = "ranked"."next_order"
FROM ranked
WHERE "target"."content_version_id" = "ranked"."content_version_id"
  AND "target"."media_id" = "ranked"."media_id"
  AND "target"."role" = "ranked"."role";--> statement-breakpoint
ALTER TABLE "content_version_media" DROP CONSTRAINT "content_version_media_pk";--> statement-breakpoint
ALTER TABLE "content_version_media" ADD CONSTRAINT "content_version_media_pk" PRIMARY KEY("content_version_id","media_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "content_version_media_gallery_sort_order" ON "content_version_media" USING btree ("content_version_id","sort_order") WHERE "content_version_media"."role" = 'GALLERY';
