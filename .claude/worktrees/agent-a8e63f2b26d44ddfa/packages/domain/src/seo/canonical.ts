import { canonicalizeContentSlug } from "../publishing/slug";

export const SEO_CANONICAL_ERROR = {
  INVALID_TRUSTED_ORIGIN: "INVALID_TRUSTED_ORIGIN",
  INVALID_SLUG: "INVALID_SLUG",
} as const;

export type SeoCanonicalErrorCode =
  (typeof SEO_CANONICAL_ERROR)[keyof typeof SEO_CANONICAL_ERROR];

export type SeoCanonicalDecision<T> =
  | { ok: true; value: T }
  | { ok: false; code: SeoCanonicalErrorCode };

function parseTrustedHttpOrigin(
  trustedSiteUrl: string,
): SeoCanonicalDecision<URL> {
  let url: URL;
  try {
    url = new URL(trustedSiteUrl);
  } catch {
    return { ok: false, code: SEO_CANONICAL_ERROR.INVALID_TRUSTED_ORIGIN };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, code: SEO_CANONICAL_ERROR.INVALID_TRUSTED_ORIGIN };
  }

  if (url.username || url.password) {
    return { ok: false, code: SEO_CANONICAL_ERROR.INVALID_TRUSTED_ORIGIN };
  }

  return { ok: true, value: url };
}

/**
 * Canonical public origin comes only from configured SITE_URL.
 * Request Host headers must never be supplied here.
 */
export function publicSiteBaseUrl(trustedSiteUrl: string): string {
  const parsed = parseTrustedHttpOrigin(trustedSiteUrl);
  if (!parsed.ok) {
    throw new Error(parsed.code);
  }

  const path = parsed.value.pathname.replace(/\/+$/, "");
  return `${parsed.value.origin}${path}`;
}

export type PublicArticleCanonicalInput = {
  trustedSiteUrl: string;
  slug: string;
};

/**
 * Public article canonical URL.
 *
 * - Uses the trusted configured origin only (no Host-header input).
 * - Encodes the canonical slug as a single path segment.
 * - Never copies query parameters onto the canonical URL.
 * - Rejects invalid slugs rather than emitting an editor/draft path.
 */
export function publicArticleCanonicalUrl(
  trustedSiteUrl: string,
  slug: string,
): string {
  const decided = decidePublicArticleCanonicalUrl({
    trustedSiteUrl,
    slug,
  });
  if (!decided.ok) {
    throw new Error(decided.code);
  }
  return decided.value;
}

export function decidePublicArticleCanonicalUrl(
  input: PublicArticleCanonicalInput,
): SeoCanonicalDecision<string> {
  const baseParsed = parseTrustedHttpOrigin(input.trustedSiteUrl);
  if (!baseParsed.ok) {
    return baseParsed;
  }

  const slug = canonicalizeContentSlug(input.slug);
  if (!slug.ok) {
    return { ok: false, code: SEO_CANONICAL_ERROR.INVALID_SLUG };
  }

  const path = baseParsed.value.pathname.replace(/\/+$/, "");
  return {
    ok: true,
    value: `${baseParsed.value.origin}${path}/${encodeURIComponent(slug.value)}`,
  };
}

export function publicHomepageCanonicalUrl(trustedSiteUrl: string): string {
  return publicSiteBaseUrl(trustedSiteUrl);
}

export function publicSitemapIndexUrl(trustedSiteUrl: string): string {
  return `${publicSiteBaseUrl(trustedSiteUrl)}/sitemap.xml`;
}

export function publicSitemapShardUrl(
  trustedSiteUrl: string,
  shardId: number,
): string {
  return `${publicSiteBaseUrl(trustedSiteUrl)}/sitemap/${shardId}.xml`;
}

export function storedCanonicalConflictsWithPublic(input: {
  storedCanonicalUrl: string | null;
  publicCanonicalUrl: string;
}): boolean {
  const stored = input.storedCanonicalUrl?.trim() ?? "";
  if (stored.length === 0) {
    return false;
  }

  try {
    const storedUrl = new URL(stored);
    const publicUrl = new URL(input.publicCanonicalUrl);
    storedUrl.hash = "";
    publicUrl.hash = "";
    storedUrl.search = "";
    return storedUrl.toString() !== publicUrl.toString();
  } catch {
    return true;
  }
}

export function storedCanonicalUsesUntrustedOrigin(input: {
  storedCanonicalUrl: string | null;
  trustedSiteUrl: string;
}): boolean {
  const stored = input.storedCanonicalUrl?.trim() ?? "";
  if (stored.length === 0) {
    return false;
  }

  try {
    const storedUrl = new URL(stored);
    const trusted = new URL(publicSiteBaseUrl(input.trustedSiteUrl));
    return storedUrl.origin !== trusted.origin;
  } catch {
    return true;
  }
}

export function storedCanonicalLooksLikeEditorUrl(input: {
  storedCanonicalUrl: string | null;
  editorOrigin?: string | null;
}): boolean {
  const stored = input.storedCanonicalUrl?.trim() ?? "";
  if (stored.length === 0) {
    return false;
  }

  try {
    const storedUrl = new URL(stored);
    if (input.editorOrigin) {
      const editor = new URL(input.editorOrigin);
      if (storedUrl.origin === editor.origin) {
        return true;
      }
    }
    return (
      storedUrl.pathname.startsWith("/login") ||
      storedUrl.pathname.startsWith("/content/") ||
      storedUrl.pathname.startsWith("/api/")
    );
  } catch {
    return false;
  }
}

export function storedCanonicalHasQuery(
  storedCanonicalUrl: string | null,
): boolean {
  const stored = storedCanonicalUrl?.trim() ?? "";
  if (stored.length === 0) {
    return false;
  }

  try {
    return new URL(stored).search.length > 0;
  } catch {
    return stored.includes("?");
  }
}

export const SEO_CANONICAL_OVERRIDE_REJECTION = {
  INVALID: "INVALID",
  UNSAFE_SCHEME: "UNSAFE_SCHEME",
  CREDENTIALS: "CREDENTIALS",
  CROSS_ORIGIN: "CROSS_ORIGIN",
  INSECURE: "INSECURE",
  QUERY_OR_HASH: "QUERY_OR_HASH",
  EDITOR_PATH: "EDITOR_PATH",
} as const;

export type SeoCanonicalOverrideRejection =
  (typeof SEO_CANONICAL_OVERRIDE_REJECTION)[keyof typeof SEO_CANONICAL_OVERRIDE_REJECTION];

export type ResolvedPublicArticleCanonical = {
  url: string | null;
  generatedUrl: string | null;
  appliedOverride: boolean;
  rejection: SeoCanonicalOverrideRejection | null;
};

/**
 * Same-origin canonical override policy.
 *
 * Blank/null stored values use SITE_URL + current slug. Explicit overrides are
 * accepted only when they are a well-formed http(s) URL on the configured
 * public origin, with no credentials, query, hash, or editor/private path.
 * Cross-origin canonicals are not a product requirement and are rejected so
 * this field cannot become an arbitrary external canonical facility.
 *
 * Invalid overrides fail closed to the generated canonical. Public redirects
 * must not use this result; they resolve through trusted current slugs.
 */
export function resolvePublicArticleCanonical(input: {
  trustedSiteUrl: string;
  slug: string;
  storedCanonicalUrl: string | null | undefined;
  editorOrigin?: string | null;
}): ResolvedPublicArticleCanonical {
  const generated = decidePublicArticleCanonicalUrl({
    trustedSiteUrl: input.trustedSiteUrl,
    slug: input.slug,
  });
  const generatedUrl = generated.ok ? generated.value : null;
  const stored = input.storedCanonicalUrl?.trim() ?? "";

  if (stored.length === 0) {
    return {
      url: generatedUrl,
      generatedUrl,
      appliedOverride: false,
      rejection: null,
    };
  }

  const rejection = inspectCanonicalOverride({
    storedCanonicalUrl: stored,
    trustedSiteUrl: input.trustedSiteUrl,
    editorOrigin: input.editorOrigin,
  });
  if (rejection !== null) {
    return {
      url: generatedUrl,
      generatedUrl,
      appliedOverride: false,
      rejection,
    };
  }

  const normalized = normalizeAcceptedCanonicalOverride(stored);
  const appliedOverride = generatedUrl !== null && normalized !== generatedUrl;
  return {
    url: normalized,
    generatedUrl,
    appliedOverride,
    rejection: null,
  };
}

function inspectCanonicalOverride(input: {
  storedCanonicalUrl: string;
  trustedSiteUrl: string;
  editorOrigin?: string | null;
}): SeoCanonicalOverrideRejection | null {
  let storedUrl: URL;
  try {
    storedUrl = new URL(input.storedCanonicalUrl);
  } catch {
    return SEO_CANONICAL_OVERRIDE_REJECTION.INVALID;
  }

  if (storedUrl.protocol !== "http:" && storedUrl.protocol !== "https:") {
    return SEO_CANONICAL_OVERRIDE_REJECTION.UNSAFE_SCHEME;
  }

  if (storedUrl.username || storedUrl.password) {
    return SEO_CANONICAL_OVERRIDE_REJECTION.CREDENTIALS;
  }

  const trusted = parseTrustedHttpOrigin(input.trustedSiteUrl);
  if (!trusted.ok) {
    return SEO_CANONICAL_OVERRIDE_REJECTION.INVALID;
  }

  if (storedUrl.origin !== trusted.value.origin) {
    return SEO_CANONICAL_OVERRIDE_REJECTION.CROSS_ORIGIN;
  }

  if (trusted.value.protocol === "https:" && storedUrl.protocol !== "https:") {
    return SEO_CANONICAL_OVERRIDE_REJECTION.INSECURE;
  }

  if (storedUrl.search.length > 0 || storedUrl.hash.length > 0) {
    return SEO_CANONICAL_OVERRIDE_REJECTION.QUERY_OR_HASH;
  }

  if (
    storedCanonicalLooksLikeEditorUrl({
      storedCanonicalUrl: input.storedCanonicalUrl,
      editorOrigin: input.editorOrigin,
    })
  ) {
    return SEO_CANONICAL_OVERRIDE_REJECTION.EDITOR_PATH;
  }

  return null;
}

function normalizeAcceptedCanonicalOverride(storedCanonicalUrl: string): string {
  const url = new URL(storedCanonicalUrl);
  url.search = "";
  url.hash = "";
  const path = url.pathname.replace(/\/+$/, "") || "";
  return `${url.origin}${path}`;
}
