CREATE TYPE "public"."author_role" AS ENUM('AUTHOR', 'CONTRIBUTOR');--> statement-breakpoint
CREATE TYPE "public"."credibility" AS ENUM('CLAIM', 'CONFIRMED', 'DENIED');--> statement-breakpoint
CREATE TYPE "public"."entity_kind" AS ENUM('PERSON', 'ORGANIZATION', 'BRAND', 'PRODUCTION', 'PLACE', 'EVENT');--> statement-breakpoint
CREATE TYPE "public"."entity_role" AS ENUM('SUBJECT', 'SECONDARY', 'MENTIONED');--> statement-breakpoint
CREATE TYPE "public"."media_role" AS ENUM('HERO', 'INLINE', 'GALLERY');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('IMAGE', 'VIDEO', 'AUDIO');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('NEVER_PUBLISHED', 'PUBLISHED', 'UNPUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('DRAFT', 'IN_REVIEW', 'APPROVED');--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"slug" text NOT NULL,
	"bio" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authors_slug_key" UNIQUE("slug"),
	CONSTRAINT "authors_slug_format" CHECK ("authors"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("authors"."slug") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_key" UNIQUE("slug"),
	CONSTRAINT "categories_parent_not_self" CHECK ("categories"."parent_id" IS DISTINCT FROM "categories"."id"),
	CONSTRAINT "categories_slug_format" CHECK ("categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("categories"."slug") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"publication_status" "publication_status" DEFAULT 'NEVER_PUBLISHED' NOT NULL,
	"published_version_id" uuid,
	"draft_version_id" uuid,
	"scheduled_version_id" uuid,
	"scheduled_at" timestamp with time zone,
	"schedule_generation" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"public_date_modified" timestamp with time zone,
	"post_publish_review_required" boolean DEFAULT false NOT NULL,
	"legal_hold_at" timestamp with time zone,
	"legal_hold_reason" text,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_items_slug_key" UNIQUE("slug"),
	CONSTRAINT "content_items_slug_format" CHECK ("content_items"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("content_items"."slug") BETWEEN 1 AND 200),
	CONSTRAINT "content_items_schedule_generation_non_negative" CHECK ("content_items"."schedule_generation" >= 0),
	CONSTRAINT "content_items_schedule_pair" CHECK ((
        ("content_items"."scheduled_version_id" IS NULL AND "content_items"."scheduled_at" IS NULL)
        OR
        ("content_items"."scheduled_version_id" IS NOT NULL AND "content_items"."scheduled_at" IS NOT NULL)
      )),
	CONSTRAINT "content_items_published_draft_pointers_distinct" CHECK ("content_items"."published_version_id" IS NULL
        OR "content_items"."draft_version_id" IS NULL
        OR "content_items"."published_version_id" IS DISTINCT FROM "content_items"."draft_version_id"),
	CONSTRAINT "content_items_published_scheduled_pointers_distinct" CHECK ("content_items"."published_version_id" IS NULL
        OR "content_items"."scheduled_version_id" IS NULL
        OR "content_items"."published_version_id" IS DISTINCT FROM "content_items"."scheduled_version_id"),
	CONSTRAINT "content_items_draft_scheduled_pointers_distinct" CHECK ("content_items"."draft_version_id" IS NULL
        OR "content_items"."scheduled_version_id" IS NULL
        OR "content_items"."draft_version_id" IS DISTINCT FROM "content_items"."scheduled_version_id"),
	CONSTRAINT "content_items_published_state_coherent" CHECK ("content_items"."publication_status" <> 'PUBLISHED'
        OR (
          "content_items"."published_version_id" IS NOT NULL
          AND "content_items"."published_at" IS NOT NULL
        ))
);
--> statement-breakpoint
CREATE TABLE "content_version_authors" (
	"content_version_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"role" "author_role" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "content_version_authors_pk" PRIMARY KEY("content_version_id","author_id"),
	CONSTRAINT "content_version_authors_sort_order_non_negative" CHECK ("content_version_authors"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "content_version_categories" (
	"content_version_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "content_version_categories_pk" PRIMARY KEY("content_version_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "content_version_entities" (
	"content_version_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role" "entity_role" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "content_version_entities_pk" PRIMARY KEY("content_version_id","entity_id"),
	CONSTRAINT "content_version_entities_sort_order_non_negative" CHECK ("content_version_entities"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "content_version_media" (
	"content_version_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"role" "media_role" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"caption" text,
	"alt_text" text,
	"credit" text,
	CONSTRAINT "content_version_media_pk" PRIMARY KEY("content_version_id","media_id"),
	CONSTRAINT "content_version_media_sort_order_non_negative" CHECK ("content_version_media"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "content_version_tags" (
	"content_version_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "content_version_tags_pk" PRIMARY KEY("content_version_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"workflow_status" "workflow_status" NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"excerpt" text,
	"body" jsonb NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"canonical_url" text,
	"robots" text,
	"credibility" "credibility",
	"credibility_source" text,
	"source" text,
	"source_organization" text,
	"source_url" text,
	"syndicated" boolean DEFAULT false NOT NULL,
	"is_material_update" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_versions_content_item_id_id_key" UNIQUE("content_item_id","id"),
	CONSTRAINT "content_versions_content_item_id_version_number_key" UNIQUE("content_item_id","version_number"),
	CONSTRAINT "content_versions_version_number_positive" CHECK ("content_versions"."version_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "entity_kind" NOT NULL,
	"canonical_name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_slug_key" UNIQUE("slug"),
	CONSTRAINT "entities_slug_format" CHECK ("entities"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("entities"."slug") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE TABLE "entity_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"normalized_alias" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_aliases_entity_normalized_key" UNIQUE("entity_id","normalized_alias"),
	CONSTRAINT "entity_aliases_normalized_alias_format" CHECK ("entity_aliases"."normalized_alias" = lower("entity_aliases"."normalized_alias") AND char_length("entity_aliases"."normalized_alias") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"media_type" "media_type" NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_storage_key_key" UNIQUE("storage_key"),
	CONSTRAINT "media_byte_size_non_negative" CHECK ("media"."byte_size" >= 0),
	CONSTRAINT "media_width_positive" CHECK ("media"."width" IS NULL OR "media"."width" > 0),
	CONSTRAINT "media_height_positive" CHECK ("media"."height" IS NULL OR "media"."height" > 0)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_key" UNIQUE("slug"),
	CONSTRAINT "tags_slug_format" CHECK ("tags"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("tags"."slug") BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_published_version_same_item_fk" FOREIGN KEY ("id","published_version_id") REFERENCES "public"."content_versions"("content_item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_draft_version_same_item_fk" FOREIGN KEY ("id","draft_version_id") REFERENCES "public"."content_versions"("content_item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_scheduled_version_same_item_fk" FOREIGN KEY ("id","scheduled_version_id") REFERENCES "public"."content_versions"("content_item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version_authors" ADD CONSTRAINT "content_version_authors_version_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version_authors" ADD CONSTRAINT "content_version_authors_author_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version_categories" ADD CONSTRAINT "content_version_categories_version_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version_categories" ADD CONSTRAINT "content_version_categories_category_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version_entities" ADD CONSTRAINT "content_version_entities_version_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version_entities" ADD CONSTRAINT "content_version_entities_entity_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version_media" ADD CONSTRAINT "content_version_media_version_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version_media" ADD CONSTRAINT "content_version_media_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version_tags" ADD CONSTRAINT "content_version_tags_version_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."content_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version_tags" ADD CONSTRAINT "content_version_tags_tag_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_entity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_version_categories_one_primary" ON "content_version_categories" USING btree ("content_version_id") WHERE "content_version_categories"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "content_version_media_one_hero" ON "content_version_media" USING btree ("content_version_id") WHERE "content_version_media"."role" = 'HERO';