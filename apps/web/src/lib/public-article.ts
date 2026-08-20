import "server-only";

import { cache } from "react";
import {
  getPublicArticlePageBySlug as loadPublicArticlePageBySlug,
  type PublicArticle,
  type PublicArticlePage,
} from "@magazine/db/public";
import { env } from "./env";
import { cachedPublicArticleLoader } from "./public-article-cache";

const publicArticleReadOptions = {
  mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
};

export const getPublicArticlePageBySlug = cache((slug: string) => {
  const loadPage = cache((canonicalSlug: string) =>
    loadPublicArticlePageBySlug(canonicalSlug, publicArticleReadOptions),
  );

  return cachedPublicArticleLoader(slug, loadPage);
});

export async function getPublicArticleBySlug(slug: string): Promise<PublicArticle | null> {
  const page = await getPublicArticlePageBySlug(slug);
  return page?.status === "live" ? page.article : null;
}

export type { PublicArticle, PublicArticlePage };
