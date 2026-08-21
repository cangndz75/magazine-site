ALTER TABLE "analytics_events" DROP CONSTRAINT IF EXISTS "analytics_events_placement_check";
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_placement_check" CHECK ("analytics_events"."placement" IS NULL OR "analytics_events"."placement" IN (
        'LEAD',
        'SUPPORT_1',
        'SUPPORT_2',
        'FEATURED_1',
        'FEATURED_2',
        'FEATURED_3',
        'FEATURED_4',
        'FEATURED_5',
        'CONVERSATION',
        'RECENCY_FALLBACK',
        'HOMEPAGE_VIDEO',
        'ARTICLE_GALLERY',
        'ARTICLE_VIDEO',
        'ARTICLE_BODY'
      ));
