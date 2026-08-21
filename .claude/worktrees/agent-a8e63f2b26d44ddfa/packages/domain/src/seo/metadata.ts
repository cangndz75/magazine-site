/**
 * Public metadata title/description authority.
 *
 * These helpers are the single source of truth for HTML/OG/Twitter metadata
 * and for SEO health. Visible article H1 remains the editorial title and is
 * not resolved here.
 *
 * Descriptions are never generated from article body.
 */

export function optionalPublicText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolvePublicMetadataTitle(input: {
  seoTitle: string | null | undefined;
  title: string | null | undefined;
}): string {
  return optionalPublicText(input.seoTitle) ?? optionalPublicText(input.title) ?? "";
}

export function resolvePublicMetadataDescription(input: {
  seoDescription: string | null | undefined;
  excerpt: string | null | undefined;
  subtitle: string | null | undefined;
}): string | null {
  return (
    optionalPublicText(input.seoDescription) ??
    optionalPublicText(input.excerpt) ??
    optionalPublicText(input.subtitle)
  );
}
