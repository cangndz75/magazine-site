import { unstable_cache } from "next/cache";
import {
  publicArticleSlugCacheTag,
  publicContentCacheTag,
} from "@magazine/domain";
import type { PublicArticlePage } from "@magazine/db/public";

export const PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS = false;

export type PublicArticlePageLoader = (
  slug: string,
) => Promise<PublicArticlePage | null>;

type CacheFactory = typeof unstable_cache;

type PublicArticleSlugIdentity = {
  contentItemId: string | null;
};

export function cachedPublicArticleLoader(
  slug: string,
  loadPage: PublicArticlePageLoader,
  cacheFactory: CacheFactory = unstable_cache,
): Promise<PublicArticlePage | null> {
  const slugTag = publicArticleSlugCacheTag(slug);
  if (!slugTag) {
    return loadPage(slug);
  }

  const loadIdentity = cacheFactory(
    async (canonicalSlug: string): Promise<PublicArticleSlugIdentity> => {
      const page = await loadPage(canonicalSlug);
      const contentItemId =
        page?.status === "live"
          ? page.article.id
          : page?.status === "withdrawn"
            ? page.shell.id
            : page?.status === "redirect"
              ? page.contentItemId
              : null;
      return { contentItemId };
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
    const loadCachedPage = cacheFactory(
      async (canonicalSlug: string) => loadPage(canonicalSlug),
      ["public-article-analytics-v1", slugTag, contentTag],
      {
        revalidate: PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS,
        tags: [slugTag, contentTag],
      },
    );

    return loadCachedPage(slug).then(restorePublicArticlePageCachePayload);
  });
}

function restorePublicArticlePageCachePayload(
  page: PublicArticlePage | null,
): PublicArticlePage | null {
  if (!page) {
    return null;
  }

  if (page.status === "withdrawn") {
    return {
      status: "withdrawn",
      shell: {
        ...page.shell,
        publishedAt: new Date(page.shell.publishedAt),
        effectiveAt: new Date(page.shell.effectiveAt),
      },
    };
  }

  if (page.status === "redirect") {
    return {
      status: "redirect",
      toSlug: page.toSlug,
      contentItemId: page.contentItemId,
    };
  }

  return {
    status: "live",
    article: {
      ...page.article,
      gallery: Array.isArray(page.article.gallery) ? page.article.gallery : [],
      videos: Array.isArray(page.article.videos) ? page.article.videos : [],
      legalNotices: Array.isArray(page.article.legalNotices)
        ? page.article.legalNotices.map((notice) => ({
            ...notice,
            effectiveAt: new Date(notice.effectiveAt),
          }))
        : [],
      entities: Array.isArray(page.article.entities) ? page.article.entities : [],
      publishedAt: new Date(page.article.publishedAt),
      publicDateModified: page.article.publicDateModified
        ? new Date(page.article.publicDateModified)
        : null,
    },
  };
}
