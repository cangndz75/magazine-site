import { revalidateTag } from "next/cache";
import {
  publicArticleSlugCacheTag,
  publicContentCacheTag,
} from "@magazine/domain";

type PublicArticleCacheTarget = {
  contentItemId: string;
  slug: string;
};

type RevalidateTag = typeof revalidateTag;

export async function invalidatePublicArticleCache(
  target: PublicArticleCacheTarget,
  revalidate: RevalidateTag = revalidateTag,
): Promise<void> {
  const tags = publicArticleInvalidationTags(target);
  try {
    for (const tag of tags) {
      revalidate(tag, { expire: 0 });
    }
  } catch (error) {
    console.error("Public article cache invalidation failed.", {
      contentItemId: target.contentItemId,
      slug: target.slug,
      tags,
      error,
    });
  }
}

export function publicArticleInvalidationTags(
  target: PublicArticleCacheTarget,
): string[] {
  const slugTag = publicArticleSlugCacheTag(target.slug);
  return [
    publicContentCacheTag(target.contentItemId),
    ...(slugTag ? [slugTag] : []),
  ];
}
