import { publicSiteBaseUrl, publicSitemapIndexUrl } from "./canonical";

export const SEO_APP_ENV = {
  DEVELOPMENT: "development",
  TEST: "test",
  STAGING: "staging",
  PRODUCTION: "production",
} as const;

export type SeoAppEnv = (typeof SEO_APP_ENV)[keyof typeof SEO_APP_ENV];

export type PublicRobotsRule = {
  userAgent: string;
  allow?: string;
  disallow?: string;
};

export type PublicRobotsDocument = {
  rules: PublicRobotsRule | PublicRobotsRule[];
  sitemap?: string;
  host?: string;
};

export function publicSiteAllowsIndexing(appEnv: SeoAppEnv): boolean {
  return appEnv === SEO_APP_ENV.PRODUCTION;
}

/**
 * Site-level robots.txt. Article noindex still comes from the indexability
 * contract. Editor/private data is never protected by robots.txt alone.
 */
export function buildPublicRobotsDocument(input: {
  appEnv: SeoAppEnv;
  trustedSiteUrl: string;
}): PublicRobotsDocument {
  if (!publicSiteAllowsIndexing(input.appEnv)) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const base = publicSiteBaseUrl(input.trustedSiteUrl);
  const host = new URL(base).host;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: publicSitemapIndexUrl(input.trustedSiteUrl),
    host,
  };
}

/**
 * Editor surfaces must never be advertised as indexable, including when
 * APP_ENV is production. Authentication remains the access control.
 */
export function buildEditorRobotsDocument(): PublicRobotsDocument {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
