import { SEO_HERO_POLICY, SEO_META_DESCRIPTION_POLICY } from "./policy";
import {
  largeImagePreviewAvailable,
  PUBLIC_INDEXABILITY_REASON,
  type PublicIndexabilityDecision,
} from "./indexability";
import type { PublicPublisherIdentity } from "./publisher";
import type { NewsArticleStructuredDataInspection } from "./json-ld";
import type { ResolvedPublicArticleCanonical } from "./canonical";

export const DISCOVER_READINESS = {
  READY: "READY",
  NEEDS_ATTENTION: "NEEDS_ATTENTION",
  NOT_ELIGIBLE: "NOT_ELIGIBLE",
} as const;

export type DiscoverReadinessState =
  (typeof DISCOVER_READINESS)[keyof typeof DISCOVER_READINESS];

export const DISCOVER_FINDING_CLASS = {
  TECHNICAL_REQUIREMENT: "TECHNICAL_REQUIREMENT",
  RECOMMENDATION: "RECOMMENDATION",
  EXTERNAL_UNKNOWN: "EXTERNAL_UNKNOWN",
} as const;

export type DiscoverFindingClass =
  (typeof DISCOVER_FINDING_CLASS)[keyof typeof DISCOVER_FINDING_CLASS];

export const DISCOVER_FINDING_CODE = {
  NOT_INDEXABLE: "NOT_INDEXABLE",
  LEGALLY_WITHDRAWN: "LEGALLY_WITHDRAWN",
  CANONICAL_UNAVAILABLE: "CANONICAL_UNAVAILABLE",
  TITLE_MISSING: "TITLE_MISSING",
  PUBLIC_ORIGIN_NOT_HTTPS: "PUBLIC_ORIGIN_NOT_HTTPS",
  PUBLISHED_AT_MISSING: "PUBLISHED_AT_MISSING",
  DESCRIPTION_WEAK: "DESCRIPTION_WEAK",
  HERO_MISSING: "HERO_MISSING",
  HERO_PUBLIC_URL_MISSING: "HERO_PUBLIC_URL_MISSING",
  HERO_TOO_SMALL: "HERO_TOO_SMALL",
  HERO_DIMENSIONS_UNKNOWN: "HERO_DIMENSIONS_UNKNOWN",
  HERO_ALT_MISSING: "HERO_ALT_MISSING",
  NEWS_ARTICLE_SUPPRESSED: "NEWS_ARTICLE_SUPPRESSED",
  NEWS_ARTICLE_INCOMPLETE: "NEWS_ARTICLE_INCOMPLETE",
  PUBLISHER_MISSING: "PUBLISHER_MISSING",
  AUTHOR_MISSING: "AUTHOR_MISSING",
  LARGE_IMAGE_PREVIEW_UNAVAILABLE: "LARGE_IMAGE_PREVIEW_UNAVAILABLE",
  CRAWL_INDEX_UNKNOWN: "CRAWL_INDEX_UNKNOWN",
  DISCOVER_PLACEMENT_UNKNOWN: "DISCOVER_PLACEMENT_UNKNOWN",
} as const;

export type DiscoverFindingCode =
  (typeof DISCOVER_FINDING_CODE)[keyof typeof DISCOVER_FINDING_CODE];

export type DiscoverFinding = {
  code: DiscoverFindingCode;
  classification: DiscoverFindingClass;
  message: string;
};

export type DiscoverReadinessEvaluation = {
  state: DiscoverReadinessState;
  findings: DiscoverFinding[];
  largeImagePreviewAvailable: boolean;
  publisherConfigured: boolean;
};

export const DISCOVER_HERO_POLICY = {
  MIN_WIDTH: SEO_HERO_POLICY.RECOMMENDED_MIN_WIDTH,
  MIN_HEIGHT: SEO_HERO_POLICY.RECOMMENDED_MIN_HEIGHT,
} as const;

export type DiscoverReadinessInput = {
  trustedSiteUrl: string;
  indexability: PublicIndexabilityDecision;
  publicTitle: string;
  publicDescription: string | null;
  canonical: Pick<ResolvedPublicArticleCanonical, "url">;
  publishedAt: Date | string | null;
  authors: readonly string[];
  hero: {
    assigned: boolean;
    publicUrl: string | null;
    altText: string | null;
    width: number | null;
    height: number | null;
  } | null;
  structuredData: Pick<
    NewsArticleStructuredDataInspection,
    "wouldEmit" | "complete" | "publisherConfigured"
  >;
  publisher: PublicPublisherIdentity | null;
};

function finding(
  code: DiscoverFindingCode,
  classification: DiscoverFindingClass,
  message: string,
): DiscoverFinding {
  return { code, classification, message };
}

function isHttpsOrigin(trustedSiteUrl: string): boolean {
  try {
    return new URL(trustedSiteUrl).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Technical Discover readiness. This is not a placement, traffic, E-E-A-T,
 * or Search Console crawl guarantee.
 */
export function evaluateDiscoverReadiness(
  input: DiscoverReadinessInput,
): DiscoverReadinessEvaluation {
  const findings: DiscoverFinding[] = [];
  const previewAvailable = largeImagePreviewAvailable(input.indexability);
  const withdrawn =
    input.indexability.reason === PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_RETRACTION ||
    input.indexability.reason === PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_TAKEDOWN;

  if (withdrawn) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.LEGALLY_WITHDRAWN,
        DISCOVER_FINDING_CLASS.TECHNICAL_REQUIREMENT,
        "Legal withdrawal keeps the URL noindex, so Discover technical eligibility does not apply.",
      ),
    );
  } else if (!input.indexability.indexable) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.NOT_INDEXABLE,
        DISCOVER_FINDING_CLASS.TECHNICAL_REQUIREMENT,
        "The URL is not publicly indexable.",
      ),
    );
  }

  if (!input.canonical.url) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.CANONICAL_UNAVAILABLE,
        DISCOVER_FINDING_CLASS.TECHNICAL_REQUIREMENT,
        "A trusted canonical URL could not be resolved.",
      ),
    );
  }

  if (input.publicTitle.trim().length === 0) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.TITLE_MISSING,
        DISCOVER_FINDING_CLASS.TECHNICAL_REQUIREMENT,
        "Public metadata title is missing.",
      ),
    );
  }

  if (!isHttpsOrigin(input.trustedSiteUrl)) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.PUBLIC_ORIGIN_NOT_HTTPS,
        DISCOVER_FINDING_CLASS.TECHNICAL_REQUIREMENT,
        "The configured public origin is not HTTPS.",
      ),
    );
  }

  if (input.publishedAt == null) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.PUBLISHED_AT_MISSING,
        DISCOVER_FINDING_CLASS.TECHNICAL_REQUIREMENT,
        "Publication date is missing.",
      ),
    );
  }

  if (!previewAvailable) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.LARGE_IMAGE_PREVIEW_UNAVAILABLE,
        DISCOVER_FINDING_CLASS.TECHNICAL_REQUIREMENT,
        "max-image-preview:large is not emitted because the page is not indexable.",
      ),
    );
  }

  if (!input.structuredData.wouldEmit) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.NEWS_ARTICLE_SUPPRESSED,
        DISCOVER_FINDING_CLASS.TECHNICAL_REQUIREMENT,
        "NewsArticle JSON-LD is suppressed or incomplete for required fields.",
      ),
    );
  } else if (!input.structuredData.complete) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.NEWS_ARTICLE_INCOMPLETE,
        DISCOVER_FINDING_CLASS.RECOMMENDATION,
        "NewsArticle JSON-LD is missing recommended fields.",
      ),
    );
  }

  const description = input.publicDescription?.trim() ?? "";
  if (description.length < SEO_META_DESCRIPTION_POLICY.MIN_CHARS) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.DESCRIPTION_WEAK,
        DISCOVER_FINDING_CLASS.RECOMMENDATION,
        "Public description is missing or shorter than the editorial minimum.",
      ),
    );
  }

  if (!input.hero?.assigned) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.HERO_MISSING,
        DISCOVER_FINDING_CLASS.RECOMMENDATION,
        "No HERO image is assigned.",
      ),
    );
  } else if (!input.hero.publicUrl) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.HERO_PUBLIC_URL_MISSING,
        DISCOVER_FINDING_CLASS.RECOMMENDATION,
        "HERO has no public image URL.",
      ),
    );
  } else if (input.hero.width == null) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.HERO_DIMENSIONS_UNKNOWN,
        DISCOVER_FINDING_CLASS.RECOMMENDATION,
        "HERO dimensions are unknown, so Discover large-image suitability cannot be confirmed.",
      ),
    );
  } else if (input.hero.width < DISCOVER_HERO_POLICY.MIN_WIDTH) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.HERO_TOO_SMALL,
        DISCOVER_FINDING_CLASS.RECOMMENDATION,
        "Kaynak görsel yeterince büyük değil.",
      ),
    );
  }

  if (input.hero?.assigned && (input.hero.altText?.trim() ?? "").length === 0) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.HERO_ALT_MISSING,
        DISCOVER_FINDING_CLASS.RECOMMENDATION,
        "HERO alt text is missing.",
      ),
    );
  }

  if (!input.publisher) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.PUBLISHER_MISSING,
        DISCOVER_FINDING_CLASS.RECOMMENDATION,
        "Publisher identity is not configured.",
      ),
    );
  }

  if (input.authors.every((name) => name.trim().length === 0)) {
    findings.push(
      finding(
        DISCOVER_FINDING_CODE.AUTHOR_MISSING,
        DISCOVER_FINDING_CLASS.RECOMMENDATION,
        "No public author is attached.",
      ),
    );
  }

  findings.push(
    finding(
      DISCOVER_FINDING_CODE.CRAWL_INDEX_UNKNOWN,
      DISCOVER_FINDING_CLASS.EXTERNAL_UNKNOWN,
      "Google crawl/index status is unknown without Search Console.",
    ),
  );
  findings.push(
    finding(
      DISCOVER_FINDING_CODE.DISCOVER_PLACEMENT_UNKNOWN,
      DISCOVER_FINDING_CLASS.EXTERNAL_UNKNOWN,
      "Discover placement, E-E-A-T, and traffic are not predicted.",
    ),
  );

  const hasTechnicalBlock = findings.some(
    (item) => item.classification === DISCOVER_FINDING_CLASS.TECHNICAL_REQUIREMENT,
  );
  const hasRecommendation = findings.some(
    (item) => item.classification === DISCOVER_FINDING_CLASS.RECOMMENDATION,
  );

  const state = hasTechnicalBlock
    ? DISCOVER_READINESS.NOT_ELIGIBLE
    : hasRecommendation
      ? DISCOVER_READINESS.NEEDS_ATTENTION
      : DISCOVER_READINESS.READY;

  return {
    state,
    findings,
    largeImagePreviewAvailable: previewAvailable,
    publisherConfigured: input.publisher !== null,
  };
}

export const DISCOVER_READINESS_STATES = [
  DISCOVER_READINESS.READY,
  DISCOVER_READINESS.NEEDS_ATTENTION,
  DISCOVER_READINESS.NOT_ELIGIBLE,
] as const;

export function parseDiscoverReadinessFilter(
  raw: string | undefined,
): DiscoverReadinessState | undefined | null {
  if (raw === undefined || raw === "") {
    return undefined;
  }
  if (
    raw === DISCOVER_READINESS.READY ||
    raw === DISCOVER_READINESS.NEEDS_ATTENTION ||
    raw === DISCOVER_READINESS.NOT_ELIGIBLE
  ) {
    return raw;
  }
  return null;
}
