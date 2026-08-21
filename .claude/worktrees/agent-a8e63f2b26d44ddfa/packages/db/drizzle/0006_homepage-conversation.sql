CREATE TABLE "homepage_conversation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sort_order" integer NOT NULL,
	"label" text NOT NULL,
	"reason" text,
	"content_item_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homepage_conversation_items_sort_order_key" UNIQUE("sort_order"),
	CONSTRAINT "homepage_conversation_items_sort_order_positive" CHECK ("homepage_conversation_items"."sort_order" > 0),
	CONSTRAINT "homepage_conversation_items_label_bounds" CHECK (char_length("homepage_conversation_items"."label") BETWEEN 1 AND 80),
	CONSTRAINT "homepage_conversation_items_reason_bounds" CHECK ("homepage_conversation_items"."reason" IS NULL OR char_length("homepage_conversation_items"."reason") BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "homepage_conversation_items" ADD CONSTRAINT "homepage_conversation_items_content_item_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homepage_conversation_items_public_idx" ON "homepage_conversation_items" USING btree ("is_active","sort_order","id");