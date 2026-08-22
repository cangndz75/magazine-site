CREATE TYPE "public"."content_kind" AS ENUM('ARTICLE', 'GALLERY');--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "content_kind" "content_kind" DEFAULT 'ARTICLE' NOT NULL;
