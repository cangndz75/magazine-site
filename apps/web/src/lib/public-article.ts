import "server-only";

import { cache } from "react";
import { getPublicArticleBySlug as loadPublicArticleBySlug } from "@magazine/db/public";
import { env } from "./env";
import { cachedPublicArticleLoader } from "./public-article-cache";

export const getPublicArticleBySlug = cache((slug: string) =>
  cachedPublicArticleLoader(slug, (canonicalSlug) =>
    loadPublicArticleBySlug(canonicalSlug, {
      mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
    }),
  ),
);
