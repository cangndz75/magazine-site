import {
  PUBLIC_CACHE_OUTBOX_EVENT_TYPE,
  PUBLIC_CACHE_OUTBOX_STATUS,
  claimPublicCacheOutboxEvents,
  clampPublicCacheOutboxBatchLimit,
  markPublicCacheOutboxEventCompleted,
  markPublicCacheOutboxEventFailed,
  type PublicCacheOutboxEvent,
} from "@magazine/db/public-cache-outbox";
import { deliverPublicArticleCacheInvalidation } from "./public-cache-invalidation";

export type PublicCacheOutboxProcessSummary = {
  claimed: number;
  succeeded: number;
  retryable: number;
  dead: number;
};

export type PublicCacheOutboxProcessorDeps = {
  claim?: typeof claimPublicCacheOutboxEvents;
  deliver?: typeof deliverPublicArticleCacheInvalidation;
  markCompleted?: typeof markPublicCacheOutboxEventCompleted;
  markFailed?: typeof markPublicCacheOutboxEventFailed;
};

export async function processPublicCacheOutboxBatch(
  input: { limit?: number } = {},
  deps: PublicCacheOutboxProcessorDeps = {},
): Promise<PublicCacheOutboxProcessSummary> {
  const claim = deps.claim ?? claimPublicCacheOutboxEvents;
  const deliver = deps.deliver ?? deliverPublicArticleCacheInvalidation;
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
      await deliverEvent(event, deliver);
      if (await markCompleted(event)) {
        summary.succeeded += 1;
      }
    } catch (error) {
      const status = await markFailed(event, error);
      if (status === null) {
        continue;
      }
      logOutboxDeliveryFailure(event, error, status);
      if (status === PUBLIC_CACHE_OUTBOX_STATUS.DEAD) {
        summary.dead += 1;
      } else {
        summary.retryable += 1;
      }
    }
  }

  return summary;
}

async function deliverEvent(
  event: PublicCacheOutboxEvent,
  deliver: typeof deliverPublicArticleCacheInvalidation,
): Promise<void> {
  if (
    event.eventType !==
    PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ARTICLE_CACHE_INVALIDATE
  ) {
    throw new Error(`Unsupported public cache outbox event: ${event.eventType}`);
  }

  await deliver({
    contentItemId: event.payload.contentItemId,
    slug: event.payload.slug,
  });
}

function logOutboxDeliveryFailure(
  event: PublicCacheOutboxEvent,
  error: unknown,
  status: string,
): void {
  console.error("Public cache outbox delivery failed.", {
    outboxEventId: event.id,
    eventType: event.eventType,
    contentItemId: event.payload.contentItemId,
    attemptCount: event.attemptCount,
    status,
    error,
  });
}
