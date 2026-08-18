import { canonicalizeContentSlug } from "./publishing/slug";

export const PUBLIC_CACHE_TAG = {
  ARTICLE_SLUG_PREFIX: "article-slug",
  CONTENT_PREFIX: "content",
} as const;

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
