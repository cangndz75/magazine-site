import { CAPABILITY } from "./capability";
import { hasCapability } from "./authorization";
import { editorTimestampToEpochMs } from "./editor/concurrency";
import { isUuid } from "./editor/query-bounds";
import { publicPublishedVersionId } from "./content-item-invariants";
import type { PublicationStatus } from "./publication-status";
import type { StaffRole } from "./staff-role";

export const PUBLIC_HOMEPAGE_CONVERSATION_LIMIT = 5;
export const CONVERSATION_LABEL_MAX_LENGTH = 80;
export const CONVERSATION_REASON_MAX_LENGTH = 200;

export const CONVERSATION_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  ITEM_NOT_FOUND: "ITEM_NOT_FOUND",
  INVALID_LABEL: "INVALID_LABEL",
  INVALID_REASON: "INVALID_REASON",
  INVALID_CONTENT_ITEM: "INVALID_CONTENT_ITEM",
  INVALID_REORDER: "INVALID_REORDER",
  WRITE_CONFLICT: "WRITE_CONFLICT",
} as const;

export type ConversationErrorCode =
  (typeof CONVERSATION_ERROR)[keyof typeof CONVERSATION_ERROR];

export class ConversationError extends Error {
  readonly code: ConversationErrorCode;

  constructor(code: ConversationErrorCode, message: string = code) {
    super(message);
    this.name = "ConversationError";
    this.code = code;
  }
}

export type ConversationDecision<T> =
  | { ok: true; value: T }
  | { ok: false; code: ConversationErrorCode };

export function authorizeHomepageConversationWrite(input: {
  roles: readonly StaffRole[];
}): ConversationDecision<true> {
  if (!hasCapability(input.roles, CAPABILITY.HOMEPAGE_MANAGE)) {
    return { ok: false, code: CONVERSATION_ERROR.FORBIDDEN };
  }

  return { ok: true, value: true };
}

export function canonicalizeConversationLabel(
  raw: string,
): ConversationDecision<string> {
  const label = raw.trim();
  if (label.length === 0 || label.length > CONVERSATION_LABEL_MAX_LENGTH) {
    return { ok: false, code: CONVERSATION_ERROR.INVALID_LABEL };
  }

  return { ok: true, value: label };
}

export function canonicalizeConversationReason(
  raw: string | null | undefined,
): ConversationDecision<string | null> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }

  const reason = raw.trim();
  if (reason.length === 0) {
    return { ok: true, value: null };
  }

  if (reason.length > CONVERSATION_REASON_MAX_LENGTH) {
    return { ok: false, code: CONVERSATION_ERROR.INVALID_REASON };
  }

  return { ok: true, value: reason };
}

export function canonicalizeOptionalContentItemId(
  raw: string | null | undefined,
): ConversationDecision<string | null> {
  if (raw === undefined || raw === null || raw.trim().length === 0) {
    return { ok: true, value: null };
  }

  const id = raw.trim();
  if (!isUuid(id)) {
    return { ok: false, code: CONVERSATION_ERROR.INVALID_CONTENT_ITEM };
  }

  return { ok: true, value: id };
}

export function assertConversationExpectedUpdatedAt(input: {
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
}): ConversationDecision<true> {
  const current = editorTimestampToEpochMs(input.currentUpdatedAt);
  const expected = editorTimestampToEpochMs(input.expectedUpdatedAt);

  if (current === null || expected === null || current !== expected) {
    return { ok: false, code: CONVERSATION_ERROR.WRITE_CONFLICT };
  }

  return { ok: true, value: true };
}

export function assertConversationReorderPermutation(input: {
  currentIds: readonly string[];
  orderedIds: readonly string[];
}): ConversationDecision<string[]> {
  if (input.orderedIds.length !== input.currentIds.length) {
    return { ok: false, code: CONVERSATION_ERROR.INVALID_REORDER };
  }

  const current = new Set(input.currentIds);
  const seen = new Set<string>();
  for (const id of input.orderedIds) {
    if (!current.has(id) || seen.has(id)) {
      return { ok: false, code: CONVERSATION_ERROR.INVALID_REORDER };
    }
    seen.add(id);
  }

  return { ok: true, value: [...input.orderedIds] };
}

export function assignPublicConversationRanks<T>(
  items: readonly T[],
): Array<T & { rank: number }> {
  return items
    .slice(0, PUBLIC_HOMEPAGE_CONVERSATION_LIMIT)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

/**
 * Public article attachment is fail-closed: only a currently PUBLISHED,
 * non-deleted item with a coherent publishedVersionId may be linked.
 */
export function publicConversationArticlePointer(state: {
  contentItemId: string | null;
  publicationStatus: PublicationStatus | null;
  publishedVersionId: string | null;
  deletedAt?: Date | string | null;
  retractedAt?: Date | string | null;
  takedownAt?: Date | string | null;
}): { contentItemId: string; publishedVersionId: string } | null {
  if (state.contentItemId === null || state.publicationStatus === null) {
    return null;
  }

  const publishedVersionId = publicPublishedVersionId({
    publicationStatus: state.publicationStatus,
    publishedVersionId: state.publishedVersionId,
    deletedAt: state.deletedAt,
    retractedAt: state.retractedAt,
    takedownAt: state.takedownAt,
  });
  if (!publishedVersionId) {
    return null;
  }

  return {
    contentItemId: state.contentItemId,
    publishedVersionId,
  };
}
