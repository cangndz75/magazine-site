import { unstable_cache } from "next/cache";
import { publicArticleSlugCacheTag } from "@magazine/domain";
import type { PublicArticle } from "@magazine/db/public";

export const PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS = false;

export type PublicArticleLoader = (slug: string) => Promise<PublicArticle | null>;

type CacheFactory = typeof unstable_cache;

export function cachedPublicArticleLoader(
  slug: string,
  loadArticle: PublicArticleLoader,
  cacheFactory: CacheFactory = unstable_cache,
): Promise<PublicArticle | null> {
  const tag = publicArticleSlugCacheTag(slug);
  if (!tag) {
    return loadArticle(slug);
  }

  const loadCachedArticle = cacheFactory(
    async (canonicalSlug: string) => loadArticle(canonicalSlug),
    ["public-article", tag],
    {
      revalidate: PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS,
      tags: [tag],
    },
  );

  return loadCachedArticle(slug).then(restorePublicArticleDates);
}

function restorePublicArticleDates(article: PublicArticle | null): PublicArticle | null {
  if (!article) {
    return null;
  }

  return {
    ...article,
    publishedAt: new Date(article.publishedAt),
    publicDateModified: article.publicDateModified
      ? new Date(article.publicDateModified)
      : null,
  };
}
