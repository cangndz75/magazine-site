import {
  parseSeoRobotsOverride,
  resolvePublicArticleCanonical,
  resolvePublicIndexability,
  resolvePublicMetadataDescription,
  resolvePublicMetadataTitle,
  SEO_ROBOTS_DIRECTIVE,
  type PublicationStatus,
  type PublicIndexabilityDecision,
  type ResolvedPublicArticleCanonical,
} from "@magazine/domain";

export type SeoPreviewInput = {
  trustedSiteUrl: string;
  editorOrigin?: string | null;
  slug: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  excerpt: string | null;
  subtitle: string | null;
  storedCanonicalUrl: string | null;
  storedRobots: string | null;
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  publishedAt: string | null;
  retractedAt: string | null;
  takedownAt: string | null;
};

export type SeoSearchPreview = {
  title: string;
  visibleTitle: string;
  description: string | null;
  url: string | null;
  canonical: ResolvedPublicArticleCanonical;
  indexability: PublicIndexabilityDecision;
  robotsDirective: (typeof SEO_ROBOTS_DIRECTIVE)[keyof typeof SEO_ROBOTS_DIRECTIVE];
};

export function presentSeoSearchPreview(input: SeoPreviewInput): SeoSearchPreview {
  const title = resolvePublicMetadataTitle({
    seoTitle: input.seoTitle,
    title: input.title,
  });
  const description = resolvePublicMetadataDescription({
    seoDescription: input.seoDescription,
    excerpt: input.excerpt,
    subtitle: input.subtitle,
  });
  const canonical = resolvePublicArticleCanonical({
    trustedSiteUrl: input.trustedSiteUrl,
    slug: input.slug,
    storedCanonicalUrl: input.storedCanonicalUrl,
    editorOrigin: input.editorOrigin,
  });
  const indexability = resolvePublicIndexability({
    publicationStatus: input.publicationStatus,
    publishedVersionId: input.publishedVersionId,
    publishedAt: input.publishedAt,
    retractedAt: input.retractedAt,
    takedownAt: input.takedownAt,
    storedRobots: input.storedRobots,
  });

  return {
    title,
    visibleTitle: input.title.trim(),
    description,
    url: canonical.url,
    canonical,
    indexability,
    robotsDirective: parseSeoRobotsOverride(input.storedRobots).directive,
  };
}
