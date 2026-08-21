import {
  publicArticleCanonicalUrl as domainPublicArticleCanonicalUrl,
  publicSiteBaseUrl as domainPublicSiteBaseUrl,
} from "@magazine/domain";

/**
 * Canonical public URLs are built from configured SITE_URL + the
 * resolved article slug. Never hardcode protocol, host, or path.
 * Request Host headers are not an input to this helper.
 */
export function publicSiteBaseUrl(siteUrl: string): string {
  return domainPublicSiteBaseUrl(siteUrl);
}

export function publicArticleCanonicalUrl(siteUrl: string, slug: string): string {
  return domainPublicArticleCanonicalUrl(siteUrl, slug);
}
