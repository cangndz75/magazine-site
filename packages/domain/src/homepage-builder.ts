import { CAPABILITY } from "./capability";
import { hasCapability } from "./authorization";
import { editorTimestampToEpochMs } from "./editor/concurrency";
import { isUuid } from "./editor/query-bounds";
import { publicPublishedVersionId } from "./content-item-invariants";
import type { PublicationStatus } from "./publication-status";
import type { StaffRole } from "./staff-role";

/** Singleton homepage identity row. */
export const HOMEPAGE_CONFIG_ID = "00000000-0000-4000-8000-000000000001";

export const HOMEPAGE_SLOT_KEY = {
  LEAD: "LEAD",
  SUPPORT_1: "SUPPORT_1",
  SUPPORT_2: "SUPPORT_2",
  FEATURED_1: "FEATURED_1",
  FEATURED_2: "FEATURED_2",
  FEATURED_3: "FEATURED_3",
  FEATURED_4: "FEATURED_4",
  FEATURED_5: "FEATURED_5",
} as const;

export type HomepageSlotKey =
  (typeof HOMEPAGE_SLOT_KEY)[keyof typeof HOMEPAGE_SLOT_KEY];

export const HOMEPAGE_SLOT_KEYS = [
  HOMEPAGE_SLOT_KEY.LEAD,
  HOMEPAGE_SLOT_KEY.SUPPORT_1,
  HOMEPAGE_SLOT_KEY.SUPPORT_2,
  HOMEPAGE_SLOT_KEY.FEATURED_1,
  HOMEPAGE_SLOT_KEY.FEATURED_2,
  HOMEPAGE_SLOT_KEY.FEATURED_3,
  HOMEPAGE_SLOT_KEY.FEATURED_4,
  HOMEPAGE_SLOT_KEY.FEATURED_5,
] as const;

export const HOMEPAGE_ATF_SLOT_KEYS = [
  HOMEPAGE_SLOT_KEY.LEAD,
  HOMEPAGE_SLOT_KEY.SUPPORT_1,
  HOMEPAGE_SLOT_KEY.SUPPORT_2,
] as const;

export const HOMEPAGE_FEATURED_SLOT_KEYS = [
  HOMEPAGE_SLOT_KEY.FEATURED_1,
  HOMEPAGE_SLOT_KEY.FEATURED_2,
  HOMEPAGE_SLOT_KEY.FEATURED_3,
  HOMEPAGE_SLOT_KEY.FEATURED_4,
  HOMEPAGE_SLOT_KEY.FEATURED_5,
] as const;

export const HOMEPAGE_BUILDER_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  INVALID_SLOT: "INVALID_SLOT",
  INVALID_CONTENT_ITEM: "INVALID_CONTENT_ITEM",
  DUPLICATE_CONTENT_ITEM: "DUPLICATE_CONTENT_ITEM",
  WRITE_CONFLICT: "WRITE_CONFLICT",
  NO_DRAFT: "NO_DRAFT",
  PUBLISH_VALIDATION_FAILED: "PUBLISH_VALIDATION_FAILED",
} as const;

export type HomepageBuilderErrorCode =
  (typeof HOMEPAGE_BUILDER_ERROR)[keyof typeof HOMEPAGE_BUILDER_ERROR];

export class HomepageBuilderError extends Error {
  readonly code: HomepageBuilderErrorCode;

  constructor(code: HomepageBuilderErrorCode, message: string = code) {
    super(message);
    this.name = "HomepageBuilderError";
    this.code = code;
  }
}

export type HomepageBuilderDecision<T> =
  | { ok: true; value: T }
  | { ok: false; code: HomepageBuilderErrorCode };

export type HomepageSlotAssignment = {
  slotKey: HomepageSlotKey;
  contentItemId: string | null;
};

export type HomepageEditorialSlotInput = {
  slotKey: HomepageSlotKey;
  contentItemId: string | null;
};

export function authorizeHomepageBuilderWrite(input: {
  roles: readonly StaffRole[];
}): HomepageBuilderDecision<true> {
  if (!hasCapability(input.roles, CAPABILITY.HOMEPAGE_MANAGE)) {
    return { ok: false, code: HOMEPAGE_BUILDER_ERROR.FORBIDDEN };
  }
  return { ok: true, value: true };
}

export function assertHomepageSlotKey(
  raw: string,
): HomepageBuilderDecision<HomepageSlotKey> {
  if ((HOMEPAGE_SLOT_KEYS as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as HomepageSlotKey };
  }
  return { ok: false, code: HOMEPAGE_BUILDER_ERROR.INVALID_SLOT };
}

export type HomepageFeaturedMoveDirection = "left" | "right";

export type HomepageFeaturedNeighborMove = {
  from: HomepageSlotKey;
  to: HomepageSlotKey;
};

export function resolveHomepageFeaturedNeighborMove(input: {
  slotKey: string;
  direction: string;
}): HomepageBuilderDecision<HomepageFeaturedNeighborMove> {
  if (!(HOMEPAGE_FEATURED_SLOT_KEYS as readonly string[]).includes(input.slotKey)) {
    return { ok: false, code: HOMEPAGE_BUILDER_ERROR.INVALID_SLOT };
  }
  if (input.direction !== "left" && input.direction !== "right") {
    return { ok: false, code: HOMEPAGE_BUILDER_ERROR.INVALID_SLOT };
  }
  const from = input.slotKey as HomepageSlotKey;
  const index = HOMEPAGE_FEATURED_SLOT_KEYS.indexOf(
    from as (typeof HOMEPAGE_FEATURED_SLOT_KEYS)[number],
  );
  const neighborIndex = input.direction === "left" ? index - 1 : index + 1;
  const to = HOMEPAGE_FEATURED_SLOT_KEYS[neighborIndex];
  if (!to) {
    return { ok: false, code: HOMEPAGE_BUILDER_ERROR.INVALID_SLOT };
  }
  return { ok: true, value: { from, to } };
}

export function applyHomepageFeaturedSlotSwap(
  assignments: Readonly<Record<HomepageSlotKey, string | null>>,
  from: HomepageSlotKey,
  to: HomepageSlotKey,
): Record<HomepageSlotKey, string | null> {
  const next = { ...assignments };
  const previousFrom = next[from] ?? null;
  next[from] = next[to] ?? null;
  next[to] = previousFrom;
  return next;
}

export function canonicalizeHomepageSlotContentItemId(
  raw: string | null | undefined,
): HomepageBuilderDecision<string | null> {
  if (raw === undefined || raw === null || raw.trim().length === 0) {
    return { ok: true, value: null };
  }
  const id = raw.trim();
  if (!isUuid(id)) {
    return { ok: false, code: HOMEPAGE_BUILDER_ERROR.INVALID_CONTENT_ITEM };
  }
  return { ok: true, value: id };
}

export function assertHomepageExpectedUpdatedAt(input: {
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
}): HomepageBuilderDecision<true> {
  const current = editorTimestampToEpochMs(input.currentUpdatedAt);
  const expected = editorTimestampToEpochMs(input.expectedUpdatedAt);
  if (current === null || expected === null || current !== expected) {
    return { ok: false, code: HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT };
  }
  return { ok: true, value: true };
}

export function assertHomepageSlotAssignmentsUnique(
  assignments: readonly HomepageSlotAssignment[],
): HomepageBuilderDecision<true> {
  const seen = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.contentItemId === null) {
      continue;
    }
    if (seen.has(assignment.contentItemId)) {
      return { ok: false, code: HOMEPAGE_BUILDER_ERROR.DUPLICATE_CONTENT_ITEM };
    }
    seen.add(assignment.contentItemId);
  }
  return { ok: true, value: true };
}

export function slotsFromAssignmentMap(
  assignments: Readonly<Record<HomepageSlotKey, string | null>>,
): HomepageSlotAssignment[] {
  return HOMEPAGE_SLOT_KEYS.map((slotKey) => ({
    slotKey,
    contentItemId: assignments[slotKey] ?? null,
  }));
}

export function assignmentMapFromSlots(
  slots: readonly HomepageSlotAssignment[],
): Record<HomepageSlotKey, string | null> {
  const map = Object.fromEntries(
    HOMEPAGE_SLOT_KEYS.map((slotKey) => [slotKey, null]),
  ) as Record<HomepageSlotKey, string | null>;
  for (const slot of slots) {
    map[slot.slotKey] = slot.contentItemId;
  }
  return map;
}

export function emptyHomepageSlotMap(): Record<HomepageSlotKey, string | null> {
  return assignmentMapFromSlots([]);
}

/**
 * Draft assignments may reference non-public content. Publish-time validation
 * uses publicPublishedVersionId separately.
 */
export function publicHomepagePlacementPointer(state: {
  contentItemId: string;
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  deletedAt?: Date | string | null;
}): { contentItemId: string; publishedVersionId: string } | null {
  const publishedVersionId = publicPublishedVersionId({
    publicationStatus: state.publicationStatus,
    publishedVersionId: state.publishedVersionId,
    deletedAt: state.deletedAt,
  });
  if (!publishedVersionId) {
    return null;
  }
  return { contentItemId: state.contentItemId, publishedVersionId };
}

export type PublicHomepagePlacementResolution<T extends { id: string }> = {
  lead: T | null;
  supports: T[];
  featured: T[];
};

/**
 * Merge editorial slot assignments with recency fallback.
 * Stored composition is not mutated when a slot's article is unavailable publicly.
 */
export function resolvePublicHomepagePlacements<T extends { id: string }>(
  editorialSlots: Readonly<Record<HomepageSlotKey, string | null>>,
  fallbackCandidates: readonly T[],
  maxFeatured: number,
): PublicHomepagePlacementResolution<T> {
  const usedIds = new Set<string>();
  const fallbackQueue = [...fallbackCandidates];

  function takeFallback(): T | null {
    while (fallbackQueue.length > 0) {
      const candidate = fallbackQueue.shift();
      if (!candidate || usedIds.has(candidate.id)) {
        continue;
      }
      usedIds.add(candidate.id);
      return candidate;
    }
    return null;
  }

  function resolveEditorialOrFallback(
    slotKey: HomepageSlotKey,
  ): T | null {
    const editorialId = editorialSlots[slotKey];
    if (editorialId !== null) {
      const match = fallbackCandidates.find((candidate) => candidate.id === editorialId);
      if (match && !usedIds.has(match.id)) {
        usedIds.add(match.id);
        return match;
      }
    }
    return takeFallback();
  }

  const lead = resolveEditorialOrFallback(HOMEPAGE_SLOT_KEY.LEAD);
  const supports = [
    resolveEditorialOrFallback(HOMEPAGE_SLOT_KEY.SUPPORT_1),
    resolveEditorialOrFallback(HOMEPAGE_SLOT_KEY.SUPPORT_2),
  ].filter((story): story is T => story !== null);

  const featured: T[] = [];
  for (const slotKey of HOMEPAGE_FEATURED_SLOT_KEYS) {
    if (featured.length >= maxFeatured) {
      break;
    }
    const story = resolveEditorialOrFallback(slotKey);
    if (story) {
      featured.push(story);
    }
  }

  return { lead, supports, featured };
}

export const HOMEPAGE_AUDIT_EVENT_TYPE = {
  HOMEPAGE_DRAFT_UPDATED: "HOMEPAGE_DRAFT_UPDATED",
  HOMEPAGE_PUBLISHED: "HOMEPAGE_PUBLISHED",
} as const;

export type HomepageAuditEventType =
  (typeof HOMEPAGE_AUDIT_EVENT_TYPE)[keyof typeof HOMEPAGE_AUDIT_EVENT_TYPE];

export const HOMEPAGE_AUDIT_EVENT_TYPES = [
  HOMEPAGE_AUDIT_EVENT_TYPE.HOMEPAGE_DRAFT_UPDATED,
  HOMEPAGE_AUDIT_EVENT_TYPE.HOMEPAGE_PUBLISHED,
] as const;

export type HomepageAuditSlotChange = {
  slotKey: HomepageSlotKey;
  previousContentItemId: string | null;
  nextContentItemId: string | null;
};

export type HomepageAuditChangeSet = {
  slots?: HomepageAuditSlotChange[];
  publishedVersionId?: string;
};
