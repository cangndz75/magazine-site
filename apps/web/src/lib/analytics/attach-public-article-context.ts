import { ANALYTICS_SURFACE, signAnalyticsContext } from "@magazine/domain";
import type { PublicArticlePage } from "@magazine/db/public";

/**
 * Request-time analytics context. Public article payloads are durably cached
 * and must not freeze an expired event-time token into that cache.
 */
export function attachPublicArticleAnalyticsContext(
  page: PublicArticlePage | null,
  input: { signingKey: string; now?: Date },
): PublicArticlePage | null {
  if (!page || page.status !== "live") {
    return page;
  }

  return {
    status: "live",
    article: {
      ...page.article,
      analyticsContext: signAnalyticsContext({
        signingKey: input.signingKey,
        now: input.now ?? new Date(),
        surface: ANALYTICS_SURFACE.ARTICLE,
        contentItemId: page.article.id,
        publishedVersionId: page.article.publishedVersionId,
      }),
    },
  };
}
