/**
 * Trusted public publisher/site identity for NewsArticle JSON-LD.
 *
 * Values come from server configuration only. Request Host is never an input.
 * Incomplete configuration omits publisher rather than fabricating legal,
 * social, address, or Person data.
 */

function optionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isTrustedPublicHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  if (url.username || url.password) {
    return false;
  }
  return true;
}

export type PublicPublisherIdentityInput = {
  name?: string | null;
  url?: string | null;
  logoUrl?: string | null;
};

export type PublicPublisherIdentity = {
  name: string;
  url: string | null;
  logoUrl: string | null;
};

export type PublicPublisherOrganization = {
  "@type": "Organization";
  name: string;
  url?: string;
  logo?: {
    "@type": "ImageObject";
    url: string;
  };
};

/**
 * Resolves publisher identity from configured fields. Invalid URL/logo values
 * are suppressed field-by-field. A missing name yields no publisher at all.
 */
export function resolvePublicPublisherIdentity(
  input: PublicPublisherIdentityInput,
): PublicPublisherIdentity | null {
  const name = optionalText(input.name);
  if (!name) {
    return null;
  }

  const rawUrl = optionalText(input.url);
  const rawLogo = optionalText(input.logoUrl);

  return {
    name,
    url: rawUrl && isTrustedPublicHttpUrl(rawUrl) ? rawUrl : null,
    logoUrl: rawLogo && isTrustedPublicHttpUrl(rawLogo) ? rawLogo : null,
  };
}

export function toNewsArticlePublisherOrganization(
  identity: PublicPublisherIdentity | null,
): PublicPublisherOrganization | null {
  if (!identity) {
    return null;
  }

  const publisher: PublicPublisherOrganization = {
    "@type": "Organization",
    name: identity.name,
  };
  if (identity.url) {
    publisher.url = identity.url;
  }
  if (identity.logoUrl) {
    publisher.logo = {
      "@type": "ImageObject",
      url: identity.logoUrl,
    };
  }
  return publisher;
}

export function publicPublisherLeaksInternal(value: unknown): boolean {
  if (value === null || value === undefined || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    "storageKey" in record ||
    "storage_key" in record ||
    "internalNote" in record
  );
}
