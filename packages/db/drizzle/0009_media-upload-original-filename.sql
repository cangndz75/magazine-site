ALTER TABLE "media" ADD COLUMN "original_filename" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_original_filename_length" CHECK ("media"."original_filename" IS NULL OR char_length("media"."original_filename") BETWEEN 1 AND 200);--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_content_hash_sha256" CHECK ("media"."content_hash" IS NULL OR char_length("media"."content_hash") = 64);
