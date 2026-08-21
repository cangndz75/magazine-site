import {
  PUBLIC_ARTICLE_WITHDRAWAL_KIND,
  type PublicArticleWithdrawalKind,
} from "../public-legal";
import { PUBLICATION_STATUS, type PublicationStatus } from "../publication-status";
import { publicPublishedVersionId } from "../content-item-invariants";
import {
  parseSeoRobotsOverride,
  SEO_ROBOTS_DIRECTIVE,
} from "./robots-override";

export const PUBLIC_INDEXABILITY_REASON = {
  INDEXABLE: "INDEXABLE",
  NOT_INDEXABLE_DELETED: "NOT_INDEXABLE_DELETED",
  NOT_INDEXABLE_NEVER_PUBLISHED: "NOT_INDEXABLE_NEVER_PUBLISHED",
  NOT_INDEXABLE_UNPUBLISHED: "NOT_INDEXABLE_UNPUBLISHED",
  NOT_INDEXABLE_RETRACTION: "NOT_INDEXABLE_RETRACTION",
  NOT_INDEXABLE_TAKEDOWN: "NOT_INDEXABLE_TAKEDOWN",
  NOT_INDEXABLE_MISSING_PUBLISHED_VERSION: "NOT_INDEXABLE_MISSING_PUBLISHED_VERSION",
  NOT_INDEXABLE_NOT_FOUND: "NOT_INDEXABLE_NOT_FOUND",
  NOT_INDEXABLE_ROBOTS_OVERRIDE: "NOT_INDEXABLE_ROBOTS_OVERRIDE",
} as const;

export type PublicIndexabilityReason =
  (typeof PUBLIC_INDEXABILITY_REASON)[keyof typeof PUBLIC_INDEXABILITY_REASON];

export type PublicIndexabilityRobots = {
  index: boolean;
  follow: boolean;
};

export type PublicIndexabilityRobotsMetadata =
  | {
      index: true;
      follow: true;
      "max-image-preview": "large";
    }
  | {
      index: false;
      follow: false;
    };

export type PublicIndexabilityDecision = {
  indexable: boolean;
  reason: PublicIndexabilityReason;
  robots: PublicIndexabilityRobots;
};

function noindex(reason: PublicIndexabilityReason): PublicIndexabilityDecision {
  return {
    indexable: false,
    reason,
    robots: { index: false, follow: false },
  };
}

function indexable(): PublicIndexabilityDecision {
  return {
    indexable: true,
    reason: PUBLIC_INDEXABILITY_REASON.INDEXABLE,
    robots: { index: true, follow: true },
  };
}

export type PublicIndexabilityInput = {
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  publishedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  retractedAt?: Date | string | null;
  takedownAt?: Date | string | null;
  storedRobots?: string | null;
};

/**
 * Single server-side indexability contract for page metadata, sitemap, and
 * robots. Correction/clarification notices do not set retractedAt/takedownAt
 * and therefore remain indexable while the article stays PUBLISHED.
 *
 * A scheduledVersionId on an unpublished item is ignored: only the live
 * publishedVersionId authority can be indexable.
 */
export function resolvePublicIndexability(
  input: PublicIndexabilityInput,
): PublicIndexabilityDecision {
  if (input.deletedAt != null) {
    return noindex(PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_DELETED);
  }

  if (input.takedownAt != null) {
    return noindex(PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_TAKEDOWN);
  }

  if (input.retractedAt != null) {
    return noindex(PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_RETRACTION);
  }

  if (input.publicationStatus === PUBLICATION_STATUS.NEVER_PUBLISHED) {
    return noindex(PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_NEVER_PUBLISHED);
  }

  if (input.publicationStatus === PUBLICATION_STATUS.UNPUBLISHED) {
    return noindex(PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_UNPUBLISHED);
  }

  const publishedVersionId = publicPublishedVersionId({
    publicationStatus: input.publicationStatus,
    publishedVersionId: input.publishedVersionId,
    deletedAt: input.deletedAt,
    retractedAt: input.retractedAt,
    takedownAt: input.takedownAt,
  });

  if (publishedVersionId === null || input.publishedAt == null) {
    return noindex(
      PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_MISSING_PUBLISHED_VERSION,
    );
  }

  const robotsOverride = parseSeoRobotsOverride(input.storedRobots);
  if (robotsOverride.directive === SEO_ROBOTS_DIRECTIVE.NOINDEX) {
    return noindex(PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_ROBOTS_OVERRIDE);
  }

  return indexable();
}

export function resolveWithdrawnArticleIndexability(
  withdrawalKind: PublicArticleWithdrawalKind,
): PublicIndexabilityDecision {
  if (withdrawalKind === PUBLIC_ARTICLE_WITHDRAWAL_KIND.TAKEDOWN) {
    return noindex(PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_TAKEDOWN);
  }

  return noindex(PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_RETRACTION);
}

export function resolveMissingPublicArticleIndexability(): PublicIndexabilityDecision {
  return noindex(PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_NOT_FOUND);
}

/**
 * Next.js Metadata robots. Indexable public articles emit
 * max-image-preview:large. Non-indexable pages stay explicit noindex/nofollow
 * and never become more permissive.
 */
export function robotsMetadataForIndexability(
  decision: PublicIndexabilityDecision,
): PublicIndexabilityRobotsMetadata {
  if (decision.indexable) {
    return {
      index: true,
      follow: true,
      "max-image-preview": "large",
    };
  }

  return { index: false, follow: false };
}

export function largeImagePreviewAvailable(
  decision: PublicIndexabilityDecision,
): boolean {
  return decision.indexable;
}

export function isPublicSitemapEligible(
  input: PublicIndexabilityInput,
): boolean {
  return resolvePublicIndexability(input).indexable;
}
