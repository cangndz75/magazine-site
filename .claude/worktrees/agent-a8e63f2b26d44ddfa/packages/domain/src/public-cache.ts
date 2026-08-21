import { isUuid } from "./editor/query-bounds";
import { canonicalizeContentSlug } from "./publishing/slug";
import { canonicalizeEntitySlug } from "./entity/identity";

export const PUBLIC_CACHE_TAG = {
  ARTICLE_SLUG_PREFIX: "article-slug",
  CONTENT_PREFIX: "content",
  ENTITY_SLUG_PREFIX: "entity-slug",
  ENTITY_PREFIX: "entity",
  ENTITY_RELATED_PREFIX: "entity-related",
} as const;

export const PUBLIC_ARTICLE_CACHE_INVALIDATE_SCHEMA_VERSION = 1 as const;
export const PUBLIC_ENTITY_CACHE_INVALIDATE_SCHEMA_VERSION = 1 as const;
export const PUBLIC_CACHE_INVALIDATION_PATH =
  "/api/internal/public-cache/invalidate";

export const PUBLIC_CACHE_OUTBOX_EVENT_TYPE = {
  PUBLIC_ARTICLE_CACHE_INVALIDATE: "PUBLIC_ARTICLE_CACHE_INVALIDATE",
  PUBLIC_ENTITY_CACHE_INVALIDATE: "PUBLIC_ENTITY_CACHE_INVALIDATE",
  PUBLIC_ENTITY_RELATED_CACHE_INVALIDATE: "PUBLIC_ENTITY_RELATED_CACHE_INVALIDATE",
} as const;

export type PublicArticleCacheInvalidatePayload = {
  schemaVersion: typeof PUBLIC_ARTICLE_CACHE_INVALIDATE_SCHEMA_VERSION;
  contentItemId: string;
  slug: string;
};

export type PublicEntityCacheInvalidatePayload = {
  schemaVersion: typeof PUBLIC_ENTITY_CACHE_INVALIDATE_SCHEMA_VERSION;
  entityId: string;
  slug: string;
};

export type PublicCacheInvalidatePayload =
  | PublicArticleCacheInvalidatePayload
  | PublicEntityCacheInvalidatePayload;

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

export function publicEntitySlugCacheTag(rawSlug: string): string | null {
  const canonical = canonicalizeEntitySlug(rawSlug);
  if (!canonical.ok) {
    return null;
  }
  return `${PUBLIC_CACHE_TAG.ENTITY_SLUG_PREFIX}:${canonical.value}`;
}

export function publicEntityCacheTag(entityId: string): string {
  return `${PUBLIC_CACHE_TAG.ENTITY_PREFIX}:${entityId}`;
}

export function publicEntityRelatedCacheTag(entityId: string): string {
  return `${PUBLIC_CACHE_TAG.ENTITY_RELATED_PREFIX}:${entityId}`;
}

export function publicEntityInvalidationTags(input: {
  entityId: string;
  slug: string;
}): string[] {
  const slugTag = publicEntitySlugCacheTag(input.slug);
  return [
    publicEntityCacheTag(input.entityId),
    publicEntityRelatedCacheTag(input.entityId),
    ...(slugTag ? [slugTag] : []),
  ];
}

export function publicEntityRelatedInvalidationTags(entityId: string): string[] {
  return [publicEntityRelatedCacheTag(entityId)];
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

export function parsePublicEntityCacheInvalidatePayload(
  body: unknown,
):
  | { ok: true; value: PublicEntityCacheInvalidatePayload }
  | { ok: false } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false };
  }

  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 3 ||
    !keys.includes("schemaVersion") ||
    !keys.includes("entityId") ||
    !keys.includes("slug")
  ) {
    return { ok: false };
  }

  const schemaVersion = record.schemaVersion;
  const entityId = record.entityId;
  const slug = record.slug;

  if (schemaVersion !== PUBLIC_ENTITY_CACHE_INVALIDATE_SCHEMA_VERSION) {
    return { ok: false };
  }

  if (typeof entityId !== "string" || !isUuid(entityId)) {
    return { ok: false };
  }

  if (typeof slug !== "string" || publicEntitySlugCacheTag(slug) === null) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      schemaVersion: PUBLIC_ENTITY_CACHE_INVALIDATE_SCHEMA_VERSION,
      entityId,
      slug,
    },
  };
}

export function parsePublicCacheInvalidatePayload(
  body: unknown,
): { ok: true; value: PublicCacheInvalidatePayload } | { ok: false } {
  const article = parsePublicArticleCacheInvalidatePayload(body);
  if (article.ok) {
    return article;
  }
  return parsePublicEntityCacheInvalidatePayload(body);
}
