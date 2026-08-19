import { revalidateTag } from "next/cache";
import {
  parsePublicArticleCacheInvalidatePayload,
  publicArticleInvalidationTags,
  type PublicArticleCacheInvalidatePayload,
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
