import { unstable_cache } from "next/cache";
import {
  publicEntityCacheTag,
  publicEntityRelatedCacheTag,
  publicEntitySlugCacheTag,
} from "@magazine/domain";
import type { PublicEntityPage } from "@magazine/db/entities";

export const PUBLIC_ENTITY_CACHE_REVALIDATE_SECONDS = false;

export type PublicEntityPageLoader = (
  slug: string,
  page: number,
) => Promise<PublicEntityPage | null>;

type CacheFactory = typeof unstable_cache;

type PublicEntitySlugIdentity = {
  entityId: string | null;
};

export function cachedPublicEntityLoader(
  slug: string,
  page: number,
  loadPage: PublicEntityPageLoader,
  cacheFactory: CacheFactory = unstable_cache,
): Promise<PublicEntityPage | null> {
  const slugTag = publicEntitySlugCacheTag(slug);
  if (!slugTag) {
    return loadPage(slug, page);
  }

  const loadIdentity = cacheFactory(
    async (canonicalSlug: string): Promise<PublicEntitySlugIdentity> => {
      const result = await loadPage(canonicalSlug, 1);
      if (!result) {
        return { entityId: null };
      }
      if (result.status === "redirect") {
        return { entityId: result.entityId };
      }
      return { entityId: result.entity.entityId };
    },
    ["public-entity-identity", slugTag],
    {
      revalidate: PUBLIC_ENTITY_CACHE_REVALIDATE_SECONDS,
      tags: [slugTag],
    },
  );

  return loadIdentity(slug).then((identity) => {
    if (!identity.entityId) {
      return null;
    }

    const entityTag = publicEntityCacheTag(identity.entityId);
    const relatedTag = publicEntityRelatedCacheTag(identity.entityId);
    const loadCachedPage = cacheFactory(
      async (canonicalSlug: string, pageNumber: number) =>
        loadPage(canonicalSlug, pageNumber),
      ["public-entity-page-v1", slugTag, entityTag, `page:${page}`],
      {
        revalidate: PUBLIC_ENTITY_CACHE_REVALIDATE_SECONDS,
        tags: [slugTag, entityTag, relatedTag],
      },
    );

    return loadCachedPage(slug, page).then(restorePublicEntityPageCachePayload);
  });
}

function restorePublicEntityPageCachePayload(
  page: PublicEntityPage | null,
): PublicEntityPage | null {
  if (!page) {
    return null;
  }

  if (page.status === "redirect") {
    return page;
  }

  return {
    status: "found",
    entity: page.entity,
    stories: page.stories.map((story) => ({
      ...story,
      publishedAt: new Date(story.publishedAt),
    })),
    totalStories: page.totalStories,
    page: page.page,
    pageSize: page.pageSize,
  };
}
