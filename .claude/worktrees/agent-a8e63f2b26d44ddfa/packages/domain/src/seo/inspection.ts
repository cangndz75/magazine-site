import { hasCapability } from "../authorization";
import { CAPABILITY } from "../capability";
import {
  canAccessEditorContentByPrimaryCategory,
  type EditorStaffScope,
} from "../editor/scope";
import {
  clampEditorListLimit,
  type EditorListCursor,
} from "../editor/query-bounds";
import type { PublicationStatus } from "../publication-status";
import type { PublicArticleWithdrawalKind } from "../public-legal";
import type { SeoFinding, SeoFindingCode } from "./health";
import type { PublicIndexabilityDecision } from "./indexability";
import type { NewsArticleJsonLdField } from "./json-ld";
import type { SeoCanonicalOverrideRejection } from "./canonical";
import type { SeoRobotsDirective } from "./robots-override";
import { SEO_SLUG_GOVERNANCE } from "./policy";
import {
  type DiscoverReadinessEvaluation,
  type DiscoverReadinessState,
} from "./discover";

export const SEO_INSPECTION_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  CONTENT_NOT_FOUND: "CONTENT_NOT_FOUND",
} as const;

export type SeoInspectionErrorCode =
  (typeof SEO_INSPECTION_ERROR)[keyof typeof SEO_INSPECTION_ERROR];

export class SeoInspectionError extends Error {
  readonly code: SeoInspectionErrorCode;

  constructor(code: SeoInspectionErrorCode, message: string = code) {
    super(message);
    this.name = "SeoInspectionError";
    this.code = code;
  }
}

export type SeoInspectionDecision<T> =
  | { ok: true; value: T }
  | { ok: false; code: SeoInspectionErrorCode };

export const SEO_FINDING_FILTER = {
  ERRORS: "ERRORS",
  WARNINGS: "WARNINGS",
  HEALTHY: "HEALTHY",
} as const;

export type SeoFindingFilter =
  (typeof SEO_FINDING_FILTER)[keyof typeof SEO_FINDING_FILTER];

export const SEO_LEGAL_WITHDRAWAL_FILTER = {
  ANY: "ANY",
  RETRACTION: "RETRACTION",
  TAKEDOWN: "TAKEDOWN",
} as const;

export type SeoLegalWithdrawalFilter =
  (typeof SEO_LEGAL_WITHDRAWAL_FILTER)[keyof typeof SEO_LEGAL_WITHDRAWAL_FILTER];

export type SeoInspectionFilters = {
  limit: number;
  cursor?: EditorListCursor | null;
  search?: string | null;
  publicationStatus?: PublicationStatus;
  notPublished?: boolean;
  categoryId?: string;
  contentItemId?: string;
  indexable?: boolean;
  missingSeoTitle?: boolean;
  missingMetaDescription?: boolean;
  missingHero?: boolean;
  missingHeroAlt?: boolean;
  findingFilter?: SeoFindingFilter;
  legalWithdrawal?: SeoLegalWithdrawalFilter;
  discoverReadiness?: DiscoverReadinessState;
};

export type SeoInspectionLegalWithdrawal = {
  kind: PublicArticleWithdrawalKind;
};

export type SeoInspectionPrimaryCategory = {
  id: string;
  name: string;
  slug: string;
};

export type SeoInspectionListItem = {
  contentItemId: string;
  title: string;
  slug: string;
  publicationStatus: PublicationStatus;
  indexability: PublicIndexabilityDecision;
  findings: SeoFinding[];
  findingCodes: SeoFindingCode[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hasErrors: boolean;
  score: number;
  lastModified: Date | null;
  publishedAt: Date | null;
  publicDateModified: Date | null;
  primaryCategory: SeoInspectionPrimaryCategory | null;
  legalWithdrawal: SeoInspectionLegalWithdrawal | null;
  missingMetaDescription: boolean;
  missingHero: boolean;
  missingHeroAlt: boolean;
  discoverReadiness: DiscoverReadinessState;
};

export type SeoInspectionGovernance = {
  slugRedirectHistoryImplemented: boolean;
};

export type SeoInspectionListResult = {
  items: SeoInspectionListItem[];
  nextCursor: string | null;
  governance: SeoInspectionGovernance;
};

export const SEO_SUMMARY_MEASUREMENT = {
  SQL_HEURISTIC: "sql-heuristic",
  EXACT_SQL: "exact-sql",
} as const;

export type SeoSummaryMeasurement =
  (typeof SEO_SUMMARY_MEASUREMENT)[keyof typeof SEO_SUMMARY_MEASUREMENT];

export type SeoInspectionSummaryMeasurements = {
  accessibleCount: SeoSummaryMeasurement;
  errorCount: SeoSummaryMeasurement;
  warningCount: SeoSummaryMeasurement;
  missingMetaDescriptionCount: SeoSummaryMeasurement;
  missingHeroCount: SeoSummaryMeasurement;
  notIndexableCount: SeoSummaryMeasurement;
  healthyPublishedCount: SeoSummaryMeasurement;
};

export type SeoInspectionSummary = {
  accessibleCount: number;
  errorCount: number;
  warningCount: number;
  missingMetaDescriptionCount: number;
  missingHeroCount: number;
  notIndexableCount: number;
  healthyPublishedCount: number;
  measurements: SeoInspectionSummaryMeasurements;
};

export function seoInspectionSummaryMeasurements(): SeoInspectionSummaryMeasurements {
  return {
    accessibleCount: SEO_SUMMARY_MEASUREMENT.EXACT_SQL,
    errorCount: SEO_SUMMARY_MEASUREMENT.SQL_HEURISTIC,
    warningCount: SEO_SUMMARY_MEASUREMENT.SQL_HEURISTIC,
    missingMetaDescriptionCount: SEO_SUMMARY_MEASUREMENT.EXACT_SQL,
    missingHeroCount: SEO_SUMMARY_MEASUREMENT.EXACT_SQL,
    notIndexableCount: SEO_SUMMARY_MEASUREMENT.EXACT_SQL,
    healthyPublishedCount: SEO_SUMMARY_MEASUREMENT.SQL_HEURISTIC,
  };
}

export type SeoInspectionHeroProjection = {
  assigned: boolean;
  publicUrl: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  preferredRenditionAvailable: boolean;
  usedLegacyOriginalFallback: boolean;
  rightsInformational: boolean;
};

export type SeoInspectionCanonicalProjection = {
  resolvedUrl: string | null;
  generatedUrl: string | null;
  appliedOverride: boolean;
  storedValuePresent: boolean;
  rejection: SeoCanonicalOverrideRejection | null;
};

export type SeoInspectionRobotsProjection = {
  directive: SeoRobotsDirective;
  unrecognized: boolean;
  systemForcedNoindex: boolean;
  editorRestrictionActive: boolean;
};

export type SeoSlugHistoryEntry = {
  oldSlug: string;
  oldPath: string;
  destinationSlug: string;
  destinationPath: string;
  destinationUrl: string | null;
  createdAt: Date;
  actorDisplayName: string | null;
};

export type SeoInspectionStructuredDataProjection = {
  wouldEmit: boolean;
  complete: boolean;
  presentFields: NewsArticleJsonLdField[];
  missingRequiredFields: NewsArticleJsonLdField[];
  missingRecommendedFields: NewsArticleJsonLdField[];
  publisherConfigured: boolean;
};

export type SeoInspectionDetail = SeoInspectionListItem & {
  articleTitle: string;
  publicTitle: string;
  publicDescription: string | null;
  publicCanonicalUrl: string | null;
  canonical: SeoInspectionCanonicalProjection;
  robots: SeoInspectionRobotsProjection;
  structuredData: SeoInspectionStructuredDataProjection;
  hero: SeoInspectionHeroProjection;
  slugHistory: SeoSlugHistoryEntry[];
  inspectedVersionIsPublicAuthority: boolean;
  discover: DiscoverReadinessEvaluation;
};

/**
 * Reuses CONTENT_READ. Super Admin inherits it; scoped Editors remain
 * bound by category scope at the query layer.
 */
export function authorizeSeoInspection(input: {
  roles: EditorStaffScope["roles"];
}): SeoInspectionDecision<true> {
  if (!hasCapability(input.roles, CAPABILITY.CONTENT_READ)) {
    return { ok: false, code: SEO_INSPECTION_ERROR.FORBIDDEN };
  }

  return { ok: true, value: true };
}

export function canAccessSeoInspectionItem(input: {
  roles: EditorStaffScope["roles"];
  scopeMode: EditorStaffScope["scopeMode"];
  scopedCategoryIds: EditorStaffScope["scopedCategoryIds"];
  primaryCategoryId: string | null;
}): boolean {
  if (!hasCapability(input.roles, CAPABILITY.CONTENT_READ)) {
    return false;
  }

  return canAccessEditorContentByPrimaryCategory(input);
}

export function seoInspectionGovernance(): SeoInspectionGovernance {
  return {
    slugRedirectHistoryImplemented: SEO_SLUG_GOVERNANCE.REDIRECT_HISTORY_IMPLEMENTED,
  };
}

export function clampSeoInspectionLimit(raw: number | undefined): number {
  return clampEditorListLimit(raw);
}

export function matchesSeoFindingFilter(
  item: Pick<SeoInspectionListItem, "errorCount" | "warningCount">,
  filter: SeoFindingFilter | undefined,
): boolean {
  if (filter === SEO_FINDING_FILTER.ERRORS) {
    return item.errorCount > 0;
  }
  if (filter === SEO_FINDING_FILTER.WARNINGS) {
    return item.warningCount > 0;
  }
  if (filter === SEO_FINDING_FILTER.HEALTHY) {
    return item.errorCount === 0 && item.warningCount === 0;
  }
  return true;
}

export function matchesDiscoverReadinessFilter(
  item: Pick<SeoInspectionListItem, "discoverReadiness">,
  filter: DiscoverReadinessState | undefined,
): boolean {
  if (!filter) {
    return true;
  }
  return item.discoverReadiness === filter;
}

export function parseSeoFindingFilter(
  raw: string | undefined,
): SeoFindingFilter | undefined | null {
  if (raw === undefined || raw === "") {
    return undefined;
  }
  if (
    raw === SEO_FINDING_FILTER.ERRORS ||
    raw === SEO_FINDING_FILTER.WARNINGS ||
    raw === SEO_FINDING_FILTER.HEALTHY
  ) {
    return raw;
  }
  return null;
}

export function parseSeoLegalWithdrawalFilter(
  raw: string | undefined,
): SeoLegalWithdrawalFilter | undefined | null {
  if (raw === undefined || raw === "") {
    return undefined;
  }
  if (
    raw === SEO_LEGAL_WITHDRAWAL_FILTER.ANY ||
    raw === SEO_LEGAL_WITHDRAWAL_FILTER.RETRACTION ||
    raw === SEO_LEGAL_WITHDRAWAL_FILTER.TAKEDOWN
  ) {
    return raw;
  }
  return null;
}

export function parseSeoInspectionBoolean(
  raw: string | undefined,
): boolean | undefined | null {
  if (raw === undefined || raw === "") {
    return undefined;
  }
  if (raw === "1" || raw === "true") {
    return true;
  }
  if (raw === "0" || raw === "false") {
    return false;
  }
  return null;
}

const FORBIDDEN_SEO_PROJECTION_KEYS = new Set([
  "storageKey",
  "storage_key",
  "licenseNote",
  "license_note",
  "internalNote",
  "internal_note",
  "passwordHash",
  "password_hash",
  "password",
  "tokenHash",
  "token_hash",
  "secret",
  "secretCiphertext",
  "recoveryCode",
  "recoveryCodes",
  "body",
]);

export function seoInspectionLeaksSensitiveMaterial(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(seoInspectionLeaksSensitiveMaterial);
  }

  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_SEO_PROJECTION_KEYS.has(key)) {
      return true;
    }
    if (seoInspectionLeaksSensitiveMaterial(nested)) {
      return true;
    }
  }

  return false;
}

export function isMissingPublicMetaDescription(input: {
  seoDescription?: string | null;
  excerpt: string | null;
  subtitle: string | null;
}): boolean {
  const seoDescription = input.seoDescription?.trim() ?? "";
  const excerpt = input.excerpt?.trim() ?? "";
  const subtitle = input.subtitle?.trim() ?? "";
  return seoDescription.length === 0 && excerpt.length === 0 && subtitle.length === 0;
}

export function isMissingSeoTitle(seoTitle: string | null | undefined): boolean {
  return (seoTitle?.trim() ?? "").length === 0;
}
