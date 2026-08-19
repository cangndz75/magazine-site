import { unstable_cache } from "next/cache";
import {
  publicArticleSlugCacheTag,
  publicContentCacheTag,
} from "@magazine/domain";
import type { PublicArticle } from "@magazine/db/public";

export const PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS = false;

export type PublicArticleLoader = (slug: string) => Promise<PublicArticle | null>;

type CacheFactory = typeof unstable_cache;

type PublicArticleSlugIdentity = {
  contentItemId: string | null;
};

export function cachedPublicArticleLoader(
  slug: string,
  loadArticle: PublicArticleLoader,
  cacheFactory: CacheFactory = unstable_cache,
): Promise<PublicArticle | null> {
  const slugTag = publicArticleSlugCacheTag(slug);
  if (!slugTag) {
    return loadArticle(slug);
  }

  const loadIdentity = cacheFactory(
    async (canonicalSlug: string): Promise<PublicArticleSlugIdentity> => {
      const article = await loadArticle(canonicalSlug);
      return { contentItemId: article?.id ?? null };
    },
    ["public-article-identity", slugTag],
    {
      revalidate: PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS,
      tags: [slugTag],
    },
  );

  return loadIdentity(slug).then((identity) => {
    if (!identity.contentItemId) {
      return null;
    }

    const contentTag = publicContentCacheTag(identity.contentItemId);
    const loadCachedArticle = cacheFactory(
      async (canonicalSlug: string) => loadArticle(canonicalSlug),
      ["public-article", slugTag, contentTag],
      {
        revalidate: PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS,
        tags: [slugTag, contentTag],
      },
    );

    return loadCachedArticle(slug).then(restorePublicArticleCachePayload);
  });
}

function restorePublicArticleCachePayload(
  article: PublicArticle | null,
): PublicArticle | null {
  if (!article) {
    return null;
  }

  return {
    ...article,
    gallery: Array.isArray(article.gallery) ? article.gallery : [],
    videos: Array.isArray(article.videos) ? article.videos : [],
    publishedAt: new Date(article.publishedAt),
    publicDateModified: article.publicDateModified
      ? new Date(article.publicDateModified)
      : null,
  };
}
