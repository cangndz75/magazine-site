import { revalidateTag } from "next/cache";
import {
  PUBLIC_CACHE_OUTBOX_EVENT_TYPE,
  parsePublicArticleCacheInvalidatePayload,
  parsePublicEntityCacheInvalidatePayload,
  publicArticleInvalidationTags,
  publicEntityInvalidationTags,
  publicEntityRelatedInvalidationTags,
  type PublicArticleCacheInvalidatePayload,
  type PublicEntityCacheInvalidatePayload,
} from "@magazine/domain";
import { PUBLIC_CACHE_INVALIDATION_ERROR, PublicCacheInvalidationError } from "./public-cache-invalidation-auth";

type RevalidateTag = typeof revalidateTag;

export async function invalidatePublicArticleCacheFromEvent(
  event: PublicArticleCacheInvalidatePayload,
  revalidate: RevalidateTag = revalidateTag,
): Promise<string[]> {
  const tags = publicArticleInvalidationTags(event);
  for (const tag of tags) {
    revalidate(tag, { expire: 0 });
  }
  return tags;
}

export async function invalidatePublicEntityCacheFromEvent(
  event: PublicEntityCacheInvalidatePayload,
  scope:
    | typeof PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_CACHE_INVALIDATE
    | typeof PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_RELATED_CACHE_INVALIDATE,
  revalidate: RevalidateTag = revalidateTag,
): Promise<string[]> {
  const tags =
    scope === PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_RELATED_CACHE_INVALIDATE
      ? publicEntityRelatedInvalidationTags(event.entityId)
      : publicEntityInvalidationTags(event);
  for (const tag of tags) {
    revalidate(tag, { expire: 0 });
  }
  return tags;
}

export function readPublicArticleCacheInvalidateEvent(
  body: unknown,
): PublicArticleCacheInvalidatePayload {
  const parsed = parsePublicArticleCacheInvalidatePayload(body);
  if (!parsed.ok) {
    throw new PublicCacheInvalidationError(
      PUBLIC_CACHE_INVALIDATION_ERROR.INVALID_REQUEST,
      400,
    );
  }

  return parsed.value;
}

export function readPublicEntityCacheInvalidateEvent(
  body: unknown,
): PublicEntityCacheInvalidatePayload {
  const parsed = parsePublicEntityCacheInvalidatePayload(body);
  if (!parsed.ok) {
    throw new PublicCacheInvalidationError(
      PUBLIC_CACHE_INVALIDATION_ERROR.INVALID_REQUEST,
      400,
    );
  }

  return parsed.value;
}

export async function handlePublicCacheInvalidationBody(
  body: unknown,
  revalidate: RevalidateTag = revalidateTag,
): Promise<{ tags: string[] }> {
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    const eventType = record.eventType;
    const payload = record.payload;
    if (
      eventType === PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_CACHE_INVALIDATE ||
      eventType === PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_RELATED_CACHE_INVALIDATE
    ) {
      const event = readPublicEntityCacheInvalidateEvent(payload);
      const tags = await invalidatePublicEntityCacheFromEvent(
        event,
        eventType,
        revalidate,
      );
      return { tags };
    }
  }

  const event = readPublicArticleCacheInvalidateEvent(body);
  const tags = await invalidatePublicArticleCacheFromEvent(event, revalidate);
  return { tags };
}
