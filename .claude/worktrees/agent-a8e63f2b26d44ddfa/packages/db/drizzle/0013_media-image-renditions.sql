CREATE TABLE "media_renditions" (
	"media_id" uuid NOT NULL,
	"variant" text NOT NULL,
	"storage_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"byte_size" integer NOT NULL,
	CONSTRAINT "media_renditions_pk" PRIMARY KEY("media_id","variant"),
	CONSTRAINT "media_renditions_storage_key_key" UNIQUE("storage_key"),
	CONSTRAINT "media_renditions_variant_check" CHECK ("variant" IN ('thumb', 'medium', 'large')),
	CONSTRAINT "media_renditions_width_positive" CHECK ("width" > 0),
	CONSTRAINT "media_renditions_height_positive" CHECK ("height" > 0),
	CONSTRAINT "media_renditions_byte_size_non_negative" CHECK ("byte_size" >= 0)
);
--> statement-breakpoint
ALTER TABLE "media_renditions" ADD CONSTRAINT "media_renditions_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_renditions_media_idx" ON "media_renditions" USING btree ("media_id");
