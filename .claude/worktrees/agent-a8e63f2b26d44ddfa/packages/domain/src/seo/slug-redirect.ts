import { PUBLICATION_STATUS, type PublicationStatus } from "../publication-status";
import { canonicalizeContentSlug } from "../publishing/slug";
import { publicArticleCanonicalUrl } from "./canonical";

/**
 * Historical slug redirects resolve to the trusted current public slug route.
 * They never use stored canonicalUrl, request Host, or an untrusted origin.
 */
export function publicArticleRedirectTargetUrl(input: {
  trustedSiteUrl: string;
  currentSlug: string;
}): string {
  return publicArticleCanonicalUrl(input.trustedSiteUrl, input.currentSlug);
}

/**
 * Old slugs may redirect only when the current item still has a public
 * authority surface: live PUBLISHED articles and approved withdrawn shells.
 * Drafts, unpublished, never-published, deleted, and scheduled-only items
 * must not be reachable through history.
 */
export function canRedirectHistoricalPublicSlug(input: {
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  publishedAt?: Date | string | null;
  deletedAt?: Date | string | null;
}): boolean {
  if (input.deletedAt != null) {
    return false;
  }

  if (input.publicationStatus !== PUBLICATION_STATUS.PUBLISHED) {
    return false;
  }

  return input.publishedVersionId != null && input.publishedAt != null;
}

export function decideHistoricalSlugLookupKey(rawSlug: string): string | null {
  const canonical = canonicalizeContentSlug(rawSlug);
  return canonical.ok ? canonical.value : null;
}
