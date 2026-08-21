ALTER TABLE "public_cache_outbox" DROP CONSTRAINT "public_cache_outbox_event_type_check";
--> statement-breakpoint
ALTER TABLE "public_cache_outbox" ADD CONSTRAINT "public_cache_outbox_event_type_check" CHECK ("public_cache_outbox"."event_type" IN ('PUBLIC_ARTICLE_CACHE_INVALIDATE', 'PUBLIC_ENTITY_CACHE_INVALIDATE', 'PUBLIC_ENTITY_RELATED_CACHE_INVALIDATE'));
