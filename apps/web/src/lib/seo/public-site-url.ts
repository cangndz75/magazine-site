/**
 * Canonical public URLs are built from configured SITE_URL + the
 * resolved article slug. Never hardcode protocol, host, or path.
 */
export function publicSiteBaseUrl(siteUrl: string): string {
  const url = new URL(siteUrl);
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

export function publicArticleCanonicalUrl(siteUrl: string, slug: string): string {
  return `${publicSiteBaseUrl(siteUrl)}/${slug}`;
}
