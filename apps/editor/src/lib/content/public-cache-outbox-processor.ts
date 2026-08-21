import {
  PUBLIC_CACHE_OUTBOX_EVENT_TYPE,
  claimPublicCacheOutboxEvents,
  clampPublicCacheOutboxBatchLimit,
  markPublicCacheOutboxEventCompleted,
  markPublicCacheOutboxEventFailed,
  type PublicCacheOutboxEvent,
} from "@magazine/db/public-cache-outbox";
import {
  deliverPublicArticleCacheInvalidation,
  deliverPublicEntityCacheInvalidation,
} from "./public-cache-delivery";

export type PublicCacheOutboxProcessSummary = {
  claimed: number;
  succeeded: number;
  retryable: number;
  dead: number;
};

export type PublicCacheOutboxProcessorDeps = {
  claim?: typeof claimPublicCacheOutboxEvents;
  deliverArticle?: (target: { contentItemId: string; slug: string }) => Promise<void>;
  deliverEntity?: (target: {
    entityId: string;
    slug: string;
    eventType:
      | typeof PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_CACHE_INVALIDATE
      | typeof PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_RELATED_CACHE_INVALIDATE;
  }) => Promise<void>;
  markCompleted?: typeof markPublicCacheOutboxEventCompleted;
  markFailed?: typeof markPublicCacheOutboxEventFailed;
};

export async function processPublicCacheOutboxBatch(
  input: { limit?: number } = {},
  deps: PublicCacheOutboxProcessorDeps = {},
): Promise<PublicCacheOutboxProcessSummary> {
  const claim = deps.claim ?? claimPublicCacheOutboxEvents;
  const deliverArticle = deps.deliverArticle ?? deliverArticleToPublicWeb;
  const deliverEntity = deps.deliverEntity ?? deliverEntityToPublicWeb;
  const markCompleted = deps.markCompleted ?? markPublicCacheOutboxEventCompleted;
  const markFailed = deps.markFailed ?? markPublicCacheOutboxEventFailed;
  const events = await claim({ limit: clampPublicCacheOutboxBatchLimit(input.limit) });
  const summary: PublicCacheOutboxProcessSummary = {
    claimed: events.length,
    succeeded: 0,
    retryable: 0,
    dead: 0,
  };

  for (const event of events) {
    try {
      await deliverEvent(event, deliverArticle, deliverEntity);
      if (await markCompleted(event)) {
        summary.succeeded += 1;
      }
    } catch (error) {
      const status = await markFailed(event, error);
      if (status === null) {
        continue;
      }
      logOutboxDeliveryFailure(event, error, status);
      if (status === "DEAD") {
        summary.dead += 1;
      } else {
        summary.retryable += 1;
      }
    }
  }

  return summary;
}

async function deliverArticleToPublicWeb(target: {
  contentItemId: string;
  slug: string;
}): Promise<void> {
  const { env } = await import("@/lib/env");
  await deliverPublicArticleCacheInvalidation(target, {
    baseUrl: env.PUBLIC_WEB_INTERNAL_BASE_URL,
    secret: env.PUBLIC_CACHE_INVALIDATION_SECRET,
  });
}

async function deliverEntityToPublicWeb(target: {
  entityId: string;
  slug: string;
  eventType:
    | typeof PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_CACHE_INVALIDATE
    | typeof PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_RELATED_CACHE_INVALIDATE;
}): Promise<void> {
  const { env } = await import("@/lib/env");
  await deliverPublicEntityCacheInvalidation(target, {
    baseUrl: env.PUBLIC_WEB_INTERNAL_BASE_URL,
    secret: env.PUBLIC_CACHE_INVALIDATION_SECRET,
  });
}

async function deliverEvent(
  event: PublicCacheOutboxEvent,
  deliverArticle: NonNullable<PublicCacheOutboxProcessorDeps["deliverArticle"]>,
  deliverEntity: NonNullable<PublicCacheOutboxProcessorDeps["deliverEntity"]>,
): Promise<void> {
  if (
    event.eventType === PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ARTICLE_CACHE_INVALIDATE
  ) {
    await deliverArticle({
      contentItemId: event.payload.contentItemId,
      slug: event.payload.slug,
    });
    return;
  }

  if (
    event.eventType === PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_CACHE_INVALIDATE ||
    event.eventType === PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_RELATED_CACHE_INVALIDATE
  ) {
    await deliverEntity({
      entityId: event.payload.entityId,
      slug: event.payload.slug,
      eventType: event.eventType,
    });
    return;
  }

  throw new Error(`Unsupported public cache outbox event: ${event.eventType}`);
}

function logOutboxDeliveryFailure(
  event: PublicCacheOutboxEvent,
  error: unknown,
  status: string,
): void {
  console.error("Public cache outbox delivery failed.", {
    outboxEventId: event.id,
    eventType: event.eventType,
    attemptCount: event.attemptCount,
    status,
    error,
  });
}
