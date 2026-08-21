import { MEDIA_RENDITION_SURFACE, MEDIA_RENDITION_SURFACE_PREFERENCE } from "../media-rendition";
import type { MediaPublicIneligibilityReason, MediaRightsStatus } from "../media-rights";
import { PUBLICATION_STATUS, type PublicationStatus } from "../publication-status";
import { inspectStructuredArticleBody } from "./body-inspection";
import {
  decidePublicArticleCanonicalUrl,
  resolvePublicArticleCanonical,
  SEO_CANONICAL_OVERRIDE_REJECTION,
} from "./canonical";
import {
  PUBLIC_INDEXABILITY_REASON,
  resolvePublicIndexability,
  type PublicIndexabilityDecision,
} from "./indexability";
import {
  inspectNewsArticleStructuredData,
  type NewsArticleStructuredDataInspection,
} from "./json-ld";
import {
  optionalPublicText,
  resolvePublicMetadataDescription,
  resolvePublicMetadataTitle,
} from "./metadata";
import {
  SEO_FINDING_KIND,
  SEO_FINDING_SEVERITY,
  SEO_HERO_POLICY,
  SEO_META_DESCRIPTION_POLICY,
  SEO_SCORE_POLICY,
  SEO_TITLE_POLICY,
  type SeoFindingKind,
  type SeoFindingSeverity,
} from "./policy";
import {
  parseSeoRobotsOverride,
  SEO_ROBOTS_DIRECTIVE,
} from "./robots-override";

export const SEO_FINDING_CODE = {
  TITLE_MISSING: "TITLE_MISSING",
  TITLE_TOO_SHORT: "TITLE_TOO_SHORT",
  TITLE_TOO_LONG: "TITLE_TOO_LONG",
  SEO_TITLE_MISSING: "SEO_TITLE_MISSING",
  META_DESCRIPTION_MISSING: "META_DESCRIPTION_MISSING",
  META_DESCRIPTION_TOO_SHORT: "META_DESCRIPTION_TOO_SHORT",
  META_DESCRIPTION_TOO_LONG: "META_DESCRIPTION_TOO_LONG",
  SLUG_INVALID: "SLUG_INVALID",
  CANONICAL_UNTRUSTED_ORIGIN: "CANONICAL_UNTRUSTED_ORIGIN",
  CANONICAL_EDITOR_ORIGIN: "CANONICAL_EDITOR_ORIGIN",
  CANONICAL_QUERY_PARAMS: "CANONICAL_QUERY_PARAMS",
  CANONICAL_OVERRIDE_APPLIED: "CANONICAL_OVERRIDE_APPLIED",
  CANONICAL_OVERRIDE_REJECTED: "CANONICAL_OVERRIDE_REJECTED",
  HERO_MISSING: "HERO_MISSING",
  HERO_ALT_MISSING: "HERO_ALT_MISSING",
  HERO_PUBLIC_URL_MISSING: "HERO_PUBLIC_URL_MISSING",
  HERO_DIMENSIONS_UNKNOWN: "HERO_DIMENSIONS_UNKNOWN",
  HERO_DIMENSIONS_SMALL: "HERO_DIMENSIONS_SMALL",
  HERO_PREFERRED_RENDITION_MISSING: "HERO_PREFERRED_RENDITION_MISSING",
  HERO_LEGACY_RENDITION_FALLBACK: "HERO_LEGACY_RENDITION_FALLBACK",
  HERO_RIGHTS_INFORMATIONAL: "HERO_RIGHTS_INFORMATIONAL",
  BODY_EMPTY: "BODY_EMPTY",
  HEADING_MISSING: "HEADING_MISSING",
  AUTHOR_MISSING: "AUTHOR_MISSING",
  PUBLISHED_AT_MISSING: "PUBLISHED_AT_MISSING",
  PRIMARY_CATEGORY_MISSING: "PRIMARY_CATEGORY_MISSING",
  STRUCTURED_DATA_SUPPRESSED: "STRUCTURED_DATA_SUPPRESSED",
  STRUCTURED_DATA_INCOMPLETE: "STRUCTURED_DATA_INCOMPLETE",
  STRUCTURED_DATA_REQUIRED_MISSING: "STRUCTURED_DATA_REQUIRED_MISSING",
  SOCIAL_METADATA_INCOMPLETE: "SOCIAL_METADATA_INCOMPLETE",
  PUBLISHER_NOT_CONFIGURED: "PUBLISHER_NOT_CONFIGURED",
  ROBOTS_NOINDEX_OVERRIDE: "ROBOTS_NOINDEX_OVERRIDE",
  ROBOTS_UNRECOGNIZED: "ROBOTS_UNRECOGNIZED",
  SLUG_REDIRECT_COVERAGE: "SLUG_REDIRECT_COVERAGE",
  NOT_INDEXABLE: "NOT_INDEXABLE",
  LEGAL_WITHDRAWAL_NOINDEX: "LEGAL_WITHDRAWAL_NOINDEX",
} as const;

export type SeoFindingCode =
  (typeof SEO_FINDING_CODE)[keyof typeof SEO_FINDING_CODE];

export type SeoFinding = {
  code: SeoFindingCode;
  severity: SeoFindingSeverity;
  kind: SeoFindingKind;
  message: string;
};

export type SeoHeroEvaluationInput = {
  assigned: boolean;
  publicUrl: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  preferredRenditionAvailable: boolean;
  usedLegacyOriginalFallback: boolean;
  rightsEligible: boolean | null;
  rightsStatus: MediaRightsStatus | null;
  rightsReasons: readonly MediaPublicIneligibilityReason[];
};

export type SeoHealthEvaluationInput = {
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
  publishedAt: Date | string | null;
  publicDateModified: Date | string | null;
  deletedAt?: Date | string | null;
  retractedAt?: Date | string | null;
  takedownAt?: Date | string | null;
  primaryCategoryName: string | null;
  authors: readonly string[];
  hero: SeoHeroEvaluationInput | null;
  body: unknown;
  publisherName?: string | null;
  hasSlugRedirectHistory?: boolean;
};

export type SeoHealthEvaluation = {
  indexability: PublicIndexabilityDecision;
  structuredData: NewsArticleStructuredDataInspection;
  findings: SeoFinding[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hasErrors: boolean;
  score: number;
  publicCanonicalUrl: string | null;
  publicTitle: string;
  publicDescription: string | null;
};

function optionalText(value: string | null | undefined): string | null {
  return optionalPublicText(value);
}

function finding(
  code: SeoFindingCode,
  severity: SeoFindingSeverity,
  kind: SeoFindingKind,
  message: string,
): SeoFinding {
  return { code, severity, kind, message };
}

function deriveScore(findings: readonly SeoFinding[]): {
  score: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hasErrors: boolean;
} {
  const errorCount = findings.filter(
    (item) => item.severity === SEO_FINDING_SEVERITY.ERROR,
  ).length;
  const warningCount = findings.filter(
    (item) => item.severity === SEO_FINDING_SEVERITY.WARNING,
  ).length;
  const infoCount = findings.filter(
    (item) => item.severity === SEO_FINDING_SEVERITY.INFO,
  ).length;
  const hasErrors = errorCount > 0;

  if (SEO_SCORE_POLICY.ERROR_FORCES_ZERO && hasErrors) {
    return {
      score: SEO_SCORE_POLICY.MIN,
      errorCount,
      warningCount,
      infoCount,
      hasErrors,
    };
  }

  const deducted =
    warningCount * SEO_SCORE_POLICY.WARNING_PENALTY +
    infoCount * SEO_SCORE_POLICY.INFO_PENALTY;
  const score = Math.max(
    SEO_SCORE_POLICY.MIN,
    Math.min(SEO_SCORE_POLICY.MAX, SEO_SCORE_POLICY.MAX - deducted),
  );

  return { score, errorCount, warningCount, infoCount, hasErrors };
}

export function inspectHeroRenditionSuitability(input: {
  originalUrl: string | null;
  selectedUrl: string | null;
  renditionVariants: readonly string[];
}): Pick<
  SeoHeroEvaluationInput,
  "preferredRenditionAvailable" | "usedLegacyOriginalFallback"
> {
  const preferred =
    MEDIA_RENDITION_SURFACE_PREFERENCE[MEDIA_RENDITION_SURFACE.ARTICLE_HERO];
  const preferredRenditionAvailable = preferred.some((variant) =>
    input.renditionVariants.includes(variant),
  );
  const original = optionalText(input.originalUrl);
  const selected = optionalText(input.selectedUrl);
  const usedLegacyOriginalFallback =
    !preferredRenditionAvailable &&
    original !== null &&
    selected !== null &&
    original === selected;

  return { preferredRenditionAvailable, usedLegacyOriginalFallback };
}

function evaluateTitle(input: SeoHealthEvaluationInput, findings: SeoFinding[]): string {
  const publicTitle = resolvePublicMetadataTitle({
    seoTitle: input.seoTitle,
    title: input.title,
  });
  if (publicTitle.length === 0) {
    findings.push(
      finding(
        SEO_FINDING_CODE.TITLE_MISSING,
        SEO_FINDING_SEVERITY.ERROR,
        SEO_FINDING_KIND.TECHNICAL,
        "Title is required for public metadata and NewsArticle headline.",
      ),
    );
    return "";
  }

  if (optionalText(input.seoTitle) === null && optionalText(input.title) !== null) {
    findings.push(
      finding(
        SEO_FINDING_CODE.SEO_TITLE_MISSING,
        SEO_FINDING_SEVERITY.INFO,
        SEO_FINDING_KIND.EDITORIAL,
        "seoTitle is empty, so public HTML/OG/Twitter titles fall back to the article title. The visible H1 is unchanged.",
      ),
    );
  }

  if (publicTitle.length < SEO_TITLE_POLICY.MIN_CHARS) {
    findings.push(
      finding(
        SEO_FINDING_CODE.TITLE_TOO_SHORT,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        `Title is shorter than the editorial minimum of ${SEO_TITLE_POLICY.MIN_CHARS} characters.`,
      ),
    );
  } else if (publicTitle.length > SEO_TITLE_POLICY.MAX_CHARS) {
    findings.push(
      finding(
        SEO_FINDING_CODE.TITLE_TOO_LONG,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        `Title is longer than the editorial maximum of ${SEO_TITLE_POLICY.MAX_CHARS} characters.`,
      ),
    );
  }

  return publicTitle;
}

function evaluateMetaDescription(
  input: SeoHealthEvaluationInput,
  findings: SeoFinding[],
): string | null {
  const publicDescription = resolvePublicMetadataDescription({
    seoDescription: input.seoDescription,
    excerpt: input.excerpt,
    subtitle: input.subtitle,
  });
  if (publicDescription === null) {
    findings.push(
      finding(
        SEO_FINDING_CODE.META_DESCRIPTION_MISSING,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        "Public meta description is missing. The live contract uses seoDescription, then excerpt, then subtitle.",
      ),
    );
  } else if (publicDescription.length < SEO_META_DESCRIPTION_POLICY.MIN_CHARS) {
    findings.push(
      finding(
        SEO_FINDING_CODE.META_DESCRIPTION_TOO_SHORT,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        `Meta description is shorter than the editorial minimum of ${SEO_META_DESCRIPTION_POLICY.MIN_CHARS} characters.`,
      ),
    );
  } else if (publicDescription.length > SEO_META_DESCRIPTION_POLICY.MAX_CHARS) {
    findings.push(
      finding(
        SEO_FINDING_CODE.META_DESCRIPTION_TOO_LONG,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        `Meta description is longer than the editorial maximum of ${SEO_META_DESCRIPTION_POLICY.MAX_CHARS} characters.`,
      ),
    );
  }

  return publicDescription;
}

function evaluateCanonical(
  input: SeoHealthEvaluationInput,
  findings: SeoFinding[],
): string | null {
  const decided = decidePublicArticleCanonicalUrl({
    trustedSiteUrl: input.trustedSiteUrl,
    slug: input.slug,
  });
  if (!decided.ok) {
    findings.push(
      finding(
        SEO_FINDING_CODE.SLUG_INVALID,
        SEO_FINDING_SEVERITY.ERROR,
        SEO_FINDING_KIND.TECHNICAL,
        "Slug is missing or invalid, so a public canonical URL cannot be generated.",
      ),
    );
    return null;
  }

  const resolved = resolvePublicArticleCanonical({
    trustedSiteUrl: input.trustedSiteUrl,
    slug: input.slug,
    storedCanonicalUrl: input.storedCanonicalUrl,
    editorOrigin: input.editorOrigin,
  });

  if (resolved.rejection === SEO_CANONICAL_OVERRIDE_REJECTION.EDITOR_PATH) {
    findings.push(
      finding(
        SEO_FINDING_CODE.CANONICAL_EDITOR_ORIGIN,
        SEO_FINDING_SEVERITY.ERROR,
        SEO_FINDING_KIND.TECHNICAL,
        "Stored canonicalUrl points at an editor/private path. Public canonical ignores it.",
      ),
    );
  } else if (resolved.rejection === SEO_CANONICAL_OVERRIDE_REJECTION.CROSS_ORIGIN) {
    findings.push(
      finding(
        SEO_FINDING_CODE.CANONICAL_UNTRUSTED_ORIGIN,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.TECHNICAL,
        "Stored canonicalUrl uses a host other than the configured public origin and is not used.",
      ),
    );
  } else if (resolved.rejection === SEO_CANONICAL_OVERRIDE_REJECTION.QUERY_OR_HASH) {
    findings.push(
      finding(
        SEO_FINDING_CODE.CANONICAL_QUERY_PARAMS,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.TECHNICAL,
        "Stored canonicalUrl includes query parameters or a fragment. Public canonical ignores it.",
      ),
    );
  } else if (resolved.rejection !== null) {
    findings.push(
      finding(
        SEO_FINDING_CODE.CANONICAL_OVERRIDE_REJECTED,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.TECHNICAL,
        "Stored canonicalUrl failed same-origin validation. Public canonical uses the generated SITE_URL + slug.",
      ),
    );
  }

  if (resolved.appliedOverride && resolved.url !== null) {
    findings.push(
      finding(
        SEO_FINDING_CODE.CANONICAL_OVERRIDE_APPLIED,
        SEO_FINDING_SEVERITY.INFO,
        SEO_FINDING_KIND.TECHNICAL,
        "A same-origin canonical override is used for public metadata and NewsArticle.",
      ),
    );
  }

  return resolved.url;
}

function evaluateHero(
  hero: SeoHeroEvaluationInput | null,
  findings: SeoFinding[],
): void {
  if (hero === null || !hero.assigned) {
    findings.push(
      finding(
        SEO_FINDING_CODE.HERO_MISSING,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        "No HERO image is assigned. Open Graph and NewsArticle image will be omitted.",
      ),
    );
    return;
  }

  if (!optionalText(hero.altText)) {
    findings.push(
      finding(
        SEO_FINDING_CODE.HERO_ALT_MISSING,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        "HERO alt text is missing.",
      ),
    );
  }

  if (!optionalText(hero.publicUrl)) {
    findings.push(
      finding(
        SEO_FINDING_CODE.HERO_PUBLIC_URL_MISSING,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.TECHNICAL,
        "HERO is assigned but no public image URL is available.",
      ),
    );
  }

  if (hero.width == null || hero.height == null) {
    findings.push(
      finding(
        SEO_FINDING_CODE.HERO_DIMENSIONS_UNKNOWN,
        SEO_FINDING_SEVERITY.INFO,
        SEO_FINDING_KIND.TECHNICAL,
        "HERO dimensions are unknown.",
      ),
    );
  } else if (
    hero.width < SEO_HERO_POLICY.RECOMMENDED_MIN_WIDTH ||
    hero.height < SEO_HERO_POLICY.RECOMMENDED_MIN_HEIGHT
  ) {
    findings.push(
      finding(
        SEO_FINDING_CODE.HERO_DIMENSIONS_SMALL,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        `HERO is smaller than the editorial social minimum of ${SEO_HERO_POLICY.RECOMMENDED_MIN_WIDTH}×${SEO_HERO_POLICY.RECOMMENDED_MIN_HEIGHT}.`,
      ),
    );
  }

  if (!hero.preferredRenditionAvailable) {
    findings.push(
      finding(
        SEO_FINDING_CODE.HERO_PREFERRED_RENDITION_MISSING,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.TECHNICAL,
        "ARTICLE_HERO preferred LARGE rendition is not available.",
      ),
    );
  }

  if (hero.usedLegacyOriginalFallback) {
    findings.push(
      finding(
        SEO_FINDING_CODE.HERO_LEGACY_RENDITION_FALLBACK,
        SEO_FINDING_SEVERITY.INFO,
        SEO_FINDING_KIND.TECHNICAL,
        "HERO delivery is falling back to the original asset instead of a preferred rendition.",
      ),
    );
  }

  if (hero.rightsEligible === false) {
    findings.push(
      finding(
        SEO_FINDING_CODE.HERO_RIGHTS_INFORMATIONAL,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        "HERO media rights are not cleared. This is informational and does not change publication eligibility.",
      ),
    );
  }
}

/**
 * Deterministic SEO health evaluation. Findings are the source of truth.
 * Warnings never block publishing by themselves.
 */
export function evaluateSeoHealth(
  input: SeoHealthEvaluationInput,
): SeoHealthEvaluation {
  const findings: SeoFinding[] = [];
  const indexability = resolvePublicIndexability(input);
  const publicTitle = evaluateTitle(input, findings);
  const publicDescription = evaluateMetaDescription(input, findings);
  const publicCanonicalUrl = evaluateCanonical(input, findings);

  const robotsOverride = parseSeoRobotsOverride(input.storedRobots);
  if (
    robotsOverride.directive === SEO_ROBOTS_DIRECTIVE.NOINDEX &&
    indexability.reason === PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_ROBOTS_OVERRIDE
  ) {
    findings.push(
      finding(
        SEO_FINDING_CODE.ROBOTS_NOINDEX_OVERRIDE,
        SEO_FINDING_SEVERITY.INFO,
        SEO_FINDING_KIND.TECHNICAL,
        "Version robots restricts this otherwise indexable article to noindex.",
      ),
    );
  } else if (robotsOverride.unrecognized) {
    findings.push(
      finding(
        SEO_FINDING_CODE.ROBOTS_UNRECOGNIZED,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.TECHNICAL,
        "Version robots text has unrecognized tokens and is not serialized raw. Only a strict noindex/none restriction is applied.",
      ),
    );
  }

  if (input.hasSlugRedirectHistory === true) {
    findings.push(
      finding(
        SEO_FINDING_CODE.SLUG_REDIRECT_COVERAGE,
        SEO_FINDING_SEVERITY.INFO,
        SEO_FINDING_KIND.TECHNICAL,
        "Historical slugs for this item permanently redirect to the current public slug.",
      ),
    );
  }

  evaluateHero(input.hero, findings);

  const body = inspectStructuredArticleBody(input.body);
  const publishedLive =
    input.publicationStatus === PUBLICATION_STATUS.PUBLISHED &&
    indexability.indexable;
  if (!body.present) {
    findings.push(
      finding(
        SEO_FINDING_CODE.BODY_EMPTY,
        publishedLive
          ? SEO_FINDING_SEVERITY.ERROR
          : SEO_FINDING_SEVERITY.WARNING,
        publishedLive
          ? SEO_FINDING_KIND.TECHNICAL
          : SEO_FINDING_KIND.EDITORIAL,
        "Article body has no inspectable text.",
      ),
    );
  } else if (body.headingCount === 0) {
    findings.push(
      finding(
        SEO_FINDING_CODE.HEADING_MISSING,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        "Body text is present but no heading blocks were found.",
      ),
    );
  }

  if (input.authors.every((name) => optionalText(name) === null)) {
    findings.push(
      finding(
        SEO_FINDING_CODE.AUTHOR_MISSING,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        "No author display name is assigned.",
      ),
    );
  }

  if (publishedLive && input.publishedAt == null) {
    findings.push(
      finding(
        SEO_FINDING_CODE.PUBLISHED_AT_MISSING,
        SEO_FINDING_SEVERITY.ERROR,
        SEO_FINDING_KIND.TECHNICAL,
        "Published content is missing publishedAt.",
      ),
    );
  }

  if (!optionalText(input.primaryCategoryName)) {
    findings.push(
      finding(
        SEO_FINDING_CODE.PRIMARY_CATEGORY_MISSING,
        publishedLive
          ? SEO_FINDING_SEVERITY.ERROR
          : SEO_FINDING_SEVERITY.WARNING,
        publishedLive
          ? SEO_FINDING_KIND.TECHNICAL
          : SEO_FINDING_KIND.EDITORIAL,
        "Primary category is missing.",
      ),
    );
  }

  const structuredData = inspectNewsArticleStructuredData({
    suppressed: !indexability.indexable,
    headline: publicTitle,
    canonicalUrl: publicCanonicalUrl,
    datePublished: input.publishedAt,
    dateModified: input.publicDateModified,
    description: publicDescription,
    authors: input.authors,
    imageUrl: input.hero?.publicUrl ?? null,
    articleSection: input.primaryCategoryName,
    publisherName: input.publisherName ?? null,
  });

  if (!indexability.indexable) {
    const withdrawn =
      indexability.reason === PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_RETRACTION ||
      indexability.reason === PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_TAKEDOWN;
    findings.push(
      finding(
        withdrawn
          ? SEO_FINDING_CODE.LEGAL_WITHDRAWAL_NOINDEX
          : SEO_FINDING_CODE.NOT_INDEXABLE,
        SEO_FINDING_SEVERITY.INFO,
        SEO_FINDING_KIND.TECHNICAL,
        withdrawn
          ? "Legal withdrawal keeps this URL noindex. NewsArticle JSON-LD is suppressed."
          : "This item is not publicly indexable.",
      ),
    );
    if (withdrawn) {
      findings.push(
        finding(
          SEO_FINDING_CODE.STRUCTURED_DATA_SUPPRESSED,
          SEO_FINDING_SEVERITY.INFO,
          SEO_FINDING_KIND.TECHNICAL,
          "NewsArticle JSON-LD is suppressed for retraction/takedown shells.",
        ),
      );
    }
  } else if (structuredData.missingRequiredFields.length > 0) {
    findings.push(
      finding(
        SEO_FINDING_CODE.STRUCTURED_DATA_REQUIRED_MISSING,
        SEO_FINDING_SEVERITY.ERROR,
        SEO_FINDING_KIND.TECHNICAL,
        "Intended NewsArticle JSON-LD is missing required fields.",
      ),
    );
  } else if (structuredData.missingRecommendedFields.length > 0) {
    findings.push(
      finding(
        SEO_FINDING_CODE.STRUCTURED_DATA_INCOMPLETE,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        "NewsArticle JSON-LD is missing recommended fields such as author, image, or description.",
      ),
    );
  }

  if (!structuredData.publisherConfigured) {
    findings.push(
      finding(
        SEO_FINDING_CODE.PUBLISHER_NOT_CONFIGURED,
        SEO_FINDING_SEVERITY.INFO,
        SEO_FINDING_KIND.TECHNICAL,
        "Publisher is not configured; NewsArticle JSON-LD omits publisher rather than fabricating it.",
      ),
    );
  }

  const socialIncomplete =
    publicDescription === null || !optionalText(input.hero?.publicUrl ?? null);
  if (indexability.indexable && socialIncomplete) {
    findings.push(
      finding(
        SEO_FINDING_CODE.SOCIAL_METADATA_INCOMPLETE,
        SEO_FINDING_SEVERITY.WARNING,
        SEO_FINDING_KIND.EDITORIAL,
        "Open Graph/Twitter metadata is incomplete without a description or HERO image.",
      ),
    );
  }

  const scored = deriveScore(findings);
  return {
    indexability,
    structuredData,
    findings,
    publicCanonicalUrl,
    publicTitle,
    publicDescription,
    ...scored,
  };
}
