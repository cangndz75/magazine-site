CREATE TABLE "analytics_events" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"schema_version" integer NOT NULL,
	"event_name" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"anonymous_session_id" uuid,
	"anonymous_visitor_id" uuid,
	"traffic_kind" text NOT NULL,
	"traffic_source" text NOT NULL,
	"referrer_host" text,
	"content_item_id" uuid,
	"published_version_id" uuid,
	"public_slug" text,
	"surface" text NOT NULL,
	"placement" text,
	"homepage_version_id" uuid,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "analytics_events_schema_version_check" CHECK ("analytics_events"."schema_version" = 1),
	CONSTRAINT "analytics_events_event_name_check" CHECK ("analytics_events"."event_name" IN (
        'PAGE_VIEW',
        'ARTICLE_VIEW',
        'HOMEPAGE_VIEW',
        'HOMEPAGE_CONTENT_IMPRESSION',
        'HOMEPAGE_CONTENT_CLICK',
        'GALLERY_OPEN',
        'GALLERY_IMAGE_VIEW',
        'GALLERY_NAVIGATE',
        'VIDEO_IMPRESSION',
        'VIDEO_PLAY',
        'ARTICLE_OUTBOUND_CLICK',
        'ARTICLE_INTERNAL_CLICK'
      )),
	CONSTRAINT "analytics_events_traffic_kind_check" CHECK ("analytics_events"."traffic_kind" IN ('HUMAN', 'BOT', 'INTERNAL', 'TEST', 'UNKNOWN')),
	CONSTRAINT "analytics_events_traffic_source_check" CHECK ("analytics_events"."traffic_source" IN ('DIRECT', 'SEARCH', 'SOCIAL', 'INTERNAL', 'REFERRAL', 'UNKNOWN')),
	CONSTRAINT "analytics_events_surface_check" CHECK ("analytics_events"."surface" IN ('HOMEPAGE', 'ARTICLE', 'WITHDRAWN_SHELL', 'OTHER_PUBLIC')),
	CONSTRAINT "analytics_events_placement_check" CHECK ("analytics_events"."placement" IS NULL OR "analytics_events"."placement" IN (
        'LEAD',
        'SUPPORT_1',
        'SUPPORT_2',
        'FEATURED_1',
        'FEATURED_2',
        'FEATURED_3',
        'FEATURED_4',
        'FEATURED_5',
        'CONVERSATION',
        'HOMEPAGE_VIDEO',
        'ARTICLE_GALLERY',
        'ARTICLE_VIDEO',
        'ARTICLE_BODY'
      )),
	CONSTRAINT "analytics_events_properties_object" CHECK (jsonb_typeof("analytics_events"."properties") = 'object'),
	CONSTRAINT "analytics_events_referrer_host_length" CHECK ("analytics_events"."referrer_host" IS NULL OR char_length("analytics_events"."referrer_host") BETWEEN 1 AND 253),
	CONSTRAINT "analytics_events_public_slug_length" CHECK ("analytics_events"."public_slug" IS NULL OR char_length("analytics_events"."public_slug") BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE INDEX "analytics_events_name_occurred_idx" ON "analytics_events" USING btree ("event_name","occurred_at","event_id");--> statement-breakpoint
CREATE INDEX "analytics_events_content_name_occurred_idx" ON "analytics_events" USING btree ("content_item_id","event_name","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_traffic_name_occurred_idx" ON "analytics_events" USING btree ("traffic_kind","event_name","occurred_at");
