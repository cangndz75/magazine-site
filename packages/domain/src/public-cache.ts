import { isUuid } from "./editor/query-bounds";
import { canonicalizeContentSlug } from "./publishing/slug";

export const PUBLIC_CACHE_TAG = {
  ARTICLE_SLUG_PREFIX: "article-slug",
  CONTENT_PREFIX: "content",
} as const;

export const PUBLIC_ARTICLE_CACHE_INVALIDATE_SCHEMA_VERSION = 1 as const;
export const PUBLIC_CACHE_INVALIDATION_PATH =
  "/api/internal/public-cache/invalidate";

export type PublicArticleCacheInvalidatePayload = {
  schemaVersion: typeof PUBLIC_ARTICLE_CACHE_INVALIDATE_SCHEMA_VERSION;
  contentItemId: string;
  slug: string;
};

export function publicArticleSlugCacheTag(rawSlug: string): string | null {
  const canonical = canonicalizeContentSlug(rawSlug);
  if (!canonical.ok) {
    return null;
  }

  return `${PUBLIC_CACHE_TAG.ARTICLE_SLUG_PREFIX}:${canonical.value}`;
}

export function publicContentCacheTag(contentItemId: string): string {
  return `${PUBLIC_CACHE_TAG.CONTENT_PREFIX}:${contentItemId}`;
}

export function publicArticleInvalidationTags(input: {
  contentItemId: string;
  slug: string;
}): string[] {
  const slugTag = publicArticleSlugCacheTag(input.slug);
  return [
    publicContentCacheTag(input.contentItemId),
    ...(slugTag ? [slugTag] : []),
  ];
}

export function parsePublicArticleCacheInvalidatePayload(
  body: unknown,
):
  | { ok: true; value: PublicArticleCacheInvalidatePayload }
  | { ok: false } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false };
  }

  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 3 ||
    !keys.includes("schemaVersion") ||
    !keys.includes("contentItemId") ||
    !keys.includes("slug")
  ) {
    return { ok: false };
  }

  const schemaVersion = record.schemaVersion;
  const contentItemId = record.contentItemId;
  const slug = record.slug;

  if (schemaVersion !== PUBLIC_ARTICLE_CACHE_INVALIDATE_SCHEMA_VERSION) {
    return { ok: false };
  }

  if (typeof contentItemId !== "string" || !isUuid(contentItemId)) {
    return { ok: false };
  }

  if (typeof slug !== "string" || publicArticleSlugCacheTag(slug) === null) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      schemaVersion: PUBLIC_ARTICLE_CACHE_INVALIDATE_SCHEMA_VERSION,
      contentItemId,
      slug,
    },
  };
}
