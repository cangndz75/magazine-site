import { publicPublishedVersionId } from "../content-item-invariants";
import type { Credibility } from "../credibility";
import type { PublicationStatus } from "../publication-status";
import {
  PUBLIC_LEGAL_NOTICE_KIND,
  type PublicLegalNotice,
  type PublicLegalNoticeKind,
} from "../public-legal";
import {
  ENTITY_RELATED_STORIES_DEFAULT_LIMIT,
  ENTITY_RELATED_STORIES_MAX_LIMIT,
  ENTITY_STATUS,
  type EntityRole,
  type EntityStatus,
} from "./types";
import { canonicalizeEntitySlug } from "./identity";
import { entityRoleRank } from "./relationships";

export type PublicEntityAuthorityInput = {
  status: EntityStatus;
  slug: string;
  deletedAt?: Date | string | null;
  mergedIntoEntityId?: string | null;
};

export function isPublicEntityProfileEligible(
  input: PublicEntityAuthorityInput,
): boolean {
  if (input.deletedAt != null) {
    return false;
  }
  if (input.mergedIntoEntityId != null) {
    return false;
  }
  if (input.status !== ENTITY_STATUS.ACTIVE) {
    return false;
  }
  return canonicalizeEntitySlug(input.slug).ok;
}

export function isPublicEntityRedirect(input: {
  mergedIntoEntityId: string | null;
  deletedAt?: Date | string | null;
}): boolean {
  return input.deletedAt == null && input.mergedIntoEntityId !== null;
}

export function publicEntityRelationVersionId(input: {
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  relationVersionId: string;
  deletedAt?: Date | string | null;
  retractedAt?: Date | string | null;
  takedownAt?: Date | string | null;
}): string | null {
  const published = publicPublishedVersionId(input);
  if (published === null || published !== input.relationVersionId) {
    return null;
  }
  return published;
}

export type PublicEntityRelatedStory = {
  contentItemId: string;
  publishedVersionId: string;
  publishedAt: Date;
  role: EntityRole;
  credibility: Credibility | null;
  legalNoticeKind: PublicLegalNoticeKind | null;
};

export function relatedStoryLegalMarker(
  notices: readonly PublicLegalNotice[],
): PublicLegalNoticeKind | null {
  if (notices.some((notice) => notice.kind === PUBLIC_LEGAL_NOTICE_KIND.CORRECTION)) {
    return PUBLIC_LEGAL_NOTICE_KIND.CORRECTION;
  }
  if (
    notices.some((notice) => notice.kind === PUBLIC_LEGAL_NOTICE_KIND.CLARIFICATION)
  ) {
    return PUBLIC_LEGAL_NOTICE_KIND.CLARIFICATION;
  }
  return null;
}

export function comparePublicEntityRelatedStories(
  left: PublicEntityRelatedStory,
  right: PublicEntityRelatedStory,
): number {
  const byDate = right.publishedAt.getTime() - left.publishedAt.getTime();
  if (byDate !== 0) {
    return byDate;
  }
  const byRole = entityRoleRank(left.role) - entityRoleRank(right.role);
  if (byRole !== 0) {
    return byRole;
  }
  return left.contentItemId.localeCompare(right.contentItemId);
}

export function selectPublicEntityRelatedStories(
  stories: readonly PublicEntityRelatedStory[],
  page: { limit?: number; offset?: number } = {},
): PublicEntityRelatedStory[] {
  const limitRaw = page.limit ?? ENTITY_RELATED_STORIES_DEFAULT_LIMIT;
  const offsetRaw = page.offset ?? 0;
  const limit = Math.min(
    Math.max(1, Math.floor(limitRaw)),
    ENTITY_RELATED_STORIES_MAX_LIMIT,
  );
  const offset = Math.max(0, Math.floor(offsetRaw));
  return [...stories]
    .sort(comparePublicEntityRelatedStories)
    .slice(offset, offset + limit);
}

/**
 * Future timeline is derived from public related stories, not a duplicated
 * fact table. Credibility and correction markers stay on the article.
 */
export type EntityTimelinePublicEntry = PublicEntityRelatedStory;

export function toEntityTimelineEntries(
  stories: readonly PublicEntityRelatedStory[],
): EntityTimelinePublicEntry[] {
  return selectPublicEntityRelatedStories(stories, {
    limit: ENTITY_RELATED_STORIES_MAX_LIMIT,
    offset: 0,
  });
}

export function articleLegalHoldFreezesRelatedEntity(): boolean {
  return false;
}

export const ENTITY_PUBLIC_RELATED_CONTENT_POLICY = {
  AUTHORITY: "publishedVersionId of a live PUBLISHED item",
  ORDER: "publishedAt DESC, then SUBJECT/SECONDARY/MENTIONED, then contentItemId",
  EXCLUDES: [
    "draft relations",
    "review/scheduled-only versions",
    "retracted articles",
    "taken-down articles",
    "deleted items",
  ],
} as const;

export const PUBLIC_ENTITY_LOOKUP = {
  FOUND: "FOUND",
  REDIRECT: "REDIRECT",
  NOT_FOUND: "NOT_FOUND",
} as const;

export type PublicEntityLookupKind =
  (typeof PUBLIC_ENTITY_LOOKUP)[keyof typeof PUBLIC_ENTITY_LOOKUP];

export type PublicEntitySlugResolution =
  | { kind: typeof PUBLIC_ENTITY_LOOKUP.FOUND; slug: string; entityId: string }
  | { kind: typeof PUBLIC_ENTITY_LOOKUP.REDIRECT; slug: string; entityId: string }
  | { kind: typeof PUBLIC_ENTITY_LOOKUP.NOT_FOUND };

export function resolvePublicEntitySlugLookup(input: {
  requestedSlug: string;
  current:
    | {
        entityId: string;
        slug: string;
        status: EntityStatus;
        deletedAt?: Date | string | null;
        mergedIntoEntityId?: string | null;
      }
    | null;
  historicalOwner:
    | {
        entityId: string;
        slug: string;
        status: EntityStatus;
        deletedAt?: Date | string | null;
        mergedIntoEntityId?: string | null;
      }
    | null;
}): PublicEntitySlugResolution {
  const requested = canonicalizeEntitySlug(input.requestedSlug);
  if (!requested.ok) {
    return { kind: PUBLIC_ENTITY_LOOKUP.NOT_FOUND };
  }

  if (input.current && isPublicEntityProfileEligible(input.current)) {
    return {
      kind: PUBLIC_ENTITY_LOOKUP.FOUND,
      slug: input.current.slug,
      entityId: input.current.entityId,
    };
  }

  if (
    input.historicalOwner &&
    isPublicEntityProfileEligible(input.historicalOwner)
  ) {
    return {
      kind: PUBLIC_ENTITY_LOOKUP.REDIRECT,
      slug: input.historicalOwner.slug,
      entityId: input.historicalOwner.entityId,
    };
  }

  return { kind: PUBLIC_ENTITY_LOOKUP.NOT_FOUND };
}
