import {
  seoInspectionLeaksSensitiveMaterial,
  type SeoInspectionDetail,
  type SeoInspectionListItem,
  type SeoInspectionSummary,
  type SeoSlugHistoryEntry,
} from "@magazine/domain";

export type SeoListDto = {
  contentItemId: string;
  title: string;
  slug: string;
  publicationStatus: SeoInspectionListItem["publicationStatus"];
  score: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hasErrors: boolean;
  indexability: {
    indexable: boolean;
    reason: SeoInspectionListItem["indexability"]["reason"];
  };
  lastModified: string | null;
  publishedAt: string | null;
  primaryCategory: SeoInspectionListItem["primaryCategory"];
  legalWithdrawal: SeoInspectionListItem["legalWithdrawal"];
  missingMetaDescription: boolean;
  missingHero: boolean;
  missingHeroAlt: boolean;
  findingCodes: SeoInspectionListItem["findingCodes"];
  discoverReadiness: SeoInspectionListItem["discoverReadiness"];
};

function iso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

export function serializeSeoInspectionListItem(
  item: SeoInspectionListItem,
): SeoListDto {
  const dto: SeoListDto = {
    contentItemId: item.contentItemId,
    title: item.title,
    slug: item.slug,
    publicationStatus: item.publicationStatus,
    score: item.score,
    errorCount: item.errorCount,
    warningCount: item.warningCount,
    infoCount: item.infoCount,
    hasErrors: item.hasErrors,
    indexability: {
      indexable: item.indexability.indexable,
      reason: item.indexability.reason,
    },
    lastModified: iso(item.lastModified),
    publishedAt: iso(item.publishedAt),
    primaryCategory: item.primaryCategory,
    legalWithdrawal: item.legalWithdrawal,
    missingMetaDescription: item.missingMetaDescription,
    missingHero: item.missingHero,
    missingHeroAlt: item.missingHeroAlt,
    findingCodes: item.findingCodes,
    discoverReadiness: item.discoverReadiness,
  };

  if (seoInspectionLeaksSensitiveMaterial(dto)) {
    throw new Error("SEO list DTO leaked sensitive material.");
  }

  return dto;
}

export function serializeSeoSlugHistoryEntry(entry: SeoSlugHistoryEntry) {
  return {
    oldSlug: entry.oldSlug,
    oldPath: entry.oldPath,
    destinationSlug: entry.destinationSlug,
    destinationPath: entry.destinationPath,
    destinationUrl: entry.destinationUrl,
    createdAt: iso(entry.createdAt),
    actorDisplayName: entry.actorDisplayName,
  };
}

export function serializeSeoInspectionDetail(detail: SeoInspectionDetail) {
  const dto = {
    ...serializeSeoInspectionListItem(detail),
    articleTitle: detail.articleTitle,
    publicTitle: detail.publicTitle,
    publicDescription: detail.publicDescription,
    publicCanonicalUrl: detail.publicCanonicalUrl,
    findings: detail.findings,
    canonical: detail.canonical,
    robots: detail.robots,
    structuredData: detail.structuredData,
    hero: detail.hero,
    slugHistory: detail.slugHistory.map(serializeSeoSlugHistoryEntry),
    inspectedVersionIsPublicAuthority: detail.inspectedVersionIsPublicAuthority,
    discover: {
      state: detail.discover.state,
      largeImagePreviewAvailable: detail.discover.largeImagePreviewAvailable,
      publisherConfigured: detail.discover.publisherConfigured,
      findings: detail.discover.findings,
    },
  };

  if (seoInspectionLeaksSensitiveMaterial(dto)) {
    throw new Error("SEO inspector DTO leaked sensitive material.");
  }

  return dto;
}

export function serializeSeoInspectionSummary(summary: SeoInspectionSummary) {
  return {
    ...summary,
    scoped: true as const,
  };
}

export type SeoInspectorDto = ReturnType<typeof serializeSeoInspectionDetail>;
export type SeoSlugHistoryDto = ReturnType<typeof serializeSeoSlugHistoryEntry>;
