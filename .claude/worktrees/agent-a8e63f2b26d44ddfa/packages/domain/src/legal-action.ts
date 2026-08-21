import { hasCapability } from "./authorization";
import { CAPABILITY } from "./capability";
import { assertExpectedUpdatedAt } from "./editor/concurrency";
import { legalActionInvalidatesPublicCache } from "./public-legal";
import { PUBLICATION_STATUS, type PublicationStatus } from "./publication-status";
import type { StaffRole } from "./staff-role";

export const CONTENT_LEGAL_ACTION_TYPE = {
  CORRECTION: "CORRECTION",
  CLARIFICATION: "CLARIFICATION",
  RETRACTION: "RETRACTION",
  TAKEDOWN: "TAKEDOWN",
  LEGAL_HOLD: "LEGAL_HOLD",
} as const;

export type ContentLegalActionType =
  (typeof CONTENT_LEGAL_ACTION_TYPE)[keyof typeof CONTENT_LEGAL_ACTION_TYPE];

export const CONTENT_LEGAL_ACTION_TYPES = [
  CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
  CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION,
  CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
  CONTENT_LEGAL_ACTION_TYPE.TAKEDOWN,
  CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD,
] as const;

export const CONTENT_LEGAL_ACTION_POLARITY = {
  APPLY: "APPLY",
  RELEASE: "RELEASE",
} as const;

export type ContentLegalActionPolarity =
  (typeof CONTENT_LEGAL_ACTION_POLARITY)[keyof typeof CONTENT_LEGAL_ACTION_POLARITY];

export const CONTENT_LEGAL_ACTION_POLARITIES = [
  CONTENT_LEGAL_ACTION_POLARITY.APPLY,
  CONTENT_LEGAL_ACTION_POLARITY.RELEASE,
] as const;

export const CONTENT_LEGAL_REASON_CATEGORY = {
  FACTUAL_ERROR: "FACTUAL_ERROR",
  CLARIFICATION: "CLARIFICATION",
  PRIVACY: "PRIVACY",
  DEFAMATION: "DEFAMATION",
  COPYRIGHT: "COPYRIGHT",
  COURT_ORDER: "COURT_ORDER",
  REGULATORY: "REGULATORY",
  LEGAL_COMPLAINT: "LEGAL_COMPLAINT",
  EDITORIAL_STANDARDS: "EDITORIAL_STANDARDS",
  SAFETY: "SAFETY",
  OTHER: "OTHER",
} as const;

export type ContentLegalReasonCategory =
  (typeof CONTENT_LEGAL_REASON_CATEGORY)[keyof typeof CONTENT_LEGAL_REASON_CATEGORY];

export const CONTENT_LEGAL_REASON_CATEGORIES = [
  CONTENT_LEGAL_REASON_CATEGORY.FACTUAL_ERROR,
  CONTENT_LEGAL_REASON_CATEGORY.CLARIFICATION,
  CONTENT_LEGAL_REASON_CATEGORY.PRIVACY,
  CONTENT_LEGAL_REASON_CATEGORY.DEFAMATION,
  CONTENT_LEGAL_REASON_CATEGORY.COPYRIGHT,
  CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
  CONTENT_LEGAL_REASON_CATEGORY.REGULATORY,
  CONTENT_LEGAL_REASON_CATEGORY.LEGAL_COMPLAINT,
  CONTENT_LEGAL_REASON_CATEGORY.EDITORIAL_STANDARDS,
  CONTENT_LEGAL_REASON_CATEGORY.SAFETY,
  CONTENT_LEGAL_REASON_CATEGORY.OTHER,
] as const;

export const CONTENT_LEGAL_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  CONTENT_NOT_FOUND: "CONTENT_NOT_FOUND",
  CONTENT_DELETED: "CONTENT_DELETED",
  CONTENT_WRITE_CONFLICT: "CONTENT_WRITE_CONFLICT",
  INVALID_LEGAL_ACTION: "INVALID_LEGAL_ACTION",
  NOT_PUBLISHED: "NOT_PUBLISHED",
  ALREADY_RETRACTED: "ALREADY_RETRACTED",
  ALREADY_TAKEN_DOWN: "ALREADY_TAKEN_DOWN",
  LEGAL_HOLD_ALREADY_ACTIVE: "LEGAL_HOLD_ALREADY_ACTIVE",
  LEGAL_HOLD_NOT_ACTIVE: "LEGAL_HOLD_NOT_ACTIVE",
  INVALID_NOTE: "INVALID_NOTE",
} as const;

export type ContentLegalErrorCode =
  (typeof CONTENT_LEGAL_ERROR)[keyof typeof CONTENT_LEGAL_ERROR];

export class ContentLegalError extends Error {
  readonly code: ContentLegalErrorCode;

  constructor(code: ContentLegalErrorCode, message: string = code) {
    super(message);
    this.name = "ContentLegalError";
    this.code = code;
  }
}

export type ContentLegalDecision<T> =
  | { ok: true; value: T }
  | { ok: false; code: ContentLegalErrorCode };

export const CONTENT_LEGAL_TEXT_MAX = {
  INTERNAL_NOTE: 4000,
  PUBLIC_NOTE: 4000,
} as const;

export const CONTENT_LEGAL_INTERNAL_NOTE_MIN = 3;

export type ContentLegalItemState = {
  deletedAt: Date | string | null;
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  publishedAt: Date | string | null;
  legalHoldAt: Date | string | null;
  legalHoldReason: string | null;
  retractedAt: Date | string | null;
  takedownAt: Date | string | null;
  updatedAt: Date | string;
};

export type ContentLegalActionWriteInput = {
  actionType: string;
  polarity?: string;
  reasonCategory: string;
  internalNote: string;
  publicNote?: string | null;
  effectiveAt?: Date | string | null;
  expectedUpdatedAt: Date | string;
};

export type CanonicalContentLegalActionWrite = {
  actionType: ContentLegalActionType;
  polarity: ContentLegalActionPolarity;
  reasonCategory: ContentLegalReasonCategory;
  internalNote: string;
  publicNote: string | null;
  effectiveAt: Date;
};

export type ContentLegalActionPlan = CanonicalContentLegalActionWrite & {
  nextLegalHoldAt: Date | null;
  nextLegalHoldReason: ContentLegalReasonCategory | null;
  nextRetractedAt: Date | null;
  nextTakedownAt: Date | null;
  invalidatesPublicCache: boolean;
};

export function isContentLegalHoldActive(
  legalHoldAt: Date | string | null | undefined,
): boolean {
  return legalHoldAt != null;
}

export function hasPublicLegalWithdrawal(state: {
  retractedAt?: Date | string | null;
  takedownAt?: Date | string | null;
}): boolean {
  return state.retractedAt != null || state.takedownAt != null;
}

export function hasPublicationHistory(item: {
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  publishedAt: Date | string | null;
}): boolean {
  return (
    item.publishedVersionId !== null ||
    item.publishedAt !== null ||
    item.publicationStatus === PUBLICATION_STATUS.PUBLISHED ||
    item.publicationStatus === PUBLICATION_STATUS.UNPUBLISHED
  );
}

export function authorizeContentLegalMutation(input: {
  roles: readonly StaffRole[];
}): ContentLegalDecision<true> {
  if (!hasCapability(input.roles, CAPABILITY.CONTENT_LEGAL)) {
    return { ok: false, code: CONTENT_LEGAL_ERROR.FORBIDDEN };
  }
  return { ok: true, value: true };
}

function isActionType(value: string): value is ContentLegalActionType {
  return (CONTENT_LEGAL_ACTION_TYPES as readonly string[]).includes(value);
}

function isPolarity(value: string): value is ContentLegalActionPolarity {
  return (CONTENT_LEGAL_ACTION_POLARITIES as readonly string[]).includes(value);
}

function isReasonCategory(value: string): value is ContentLegalReasonCategory {
  return (CONTENT_LEGAL_REASON_CATEGORIES as readonly string[]).includes(value);
}

function canonicalizeRequiredNote(
  raw: string | null | undefined,
): ContentLegalDecision<string> {
  if (raw === undefined || raw === null) {
    return { ok: false, code: CONTENT_LEGAL_ERROR.INVALID_NOTE };
  }
  const note = raw.trim();
  if (
    note.length < CONTENT_LEGAL_INTERNAL_NOTE_MIN ||
    note.length > CONTENT_LEGAL_TEXT_MAX.INTERNAL_NOTE
  ) {
    return { ok: false, code: CONTENT_LEGAL_ERROR.INVALID_NOTE };
  }
  return { ok: true, value: note };
}

function canonicalizeOptionalPublicNote(
  raw: string | null | undefined,
): ContentLegalDecision<string | null> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  const note = raw.trim();
  if (note.length === 0) {
    return { ok: true, value: null };
  }
  if (note.length > CONTENT_LEGAL_TEXT_MAX.PUBLIC_NOTE) {
    return { ok: false, code: CONTENT_LEGAL_ERROR.INVALID_NOTE };
  }
  return { ok: true, value: note };
}

function canonicalizeEffectiveAt(
  raw: Date | string | null | undefined,
  now: Date,
): ContentLegalDecision<Date> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: now };
  }
  if (typeof raw === "string" && raw.trim().length === 0) {
    return { ok: true, value: now };
  }
  const value = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(value.getTime())) {
    return { ok: false, code: CONTENT_LEGAL_ERROR.INVALID_LEGAL_ACTION };
  }
  return { ok: true, value: value };
}

export function canonicalizeContentLegalActionWrite(input: {
  actionType: string;
  polarity?: string;
  reasonCategory: string;
  internalNote: string;
  publicNote?: string | null;
  effectiveAt?: Date | string | null;
  now: Date;
}): ContentLegalDecision<CanonicalContentLegalActionWrite> {
  if (!isActionType(input.actionType) || !isReasonCategory(input.reasonCategory)) {
    return { ok: false, code: CONTENT_LEGAL_ERROR.INVALID_LEGAL_ACTION };
  }

  const polarityRaw =
    input.polarity ??
    (input.actionType === CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD
      ? undefined
      : CONTENT_LEGAL_ACTION_POLARITY.APPLY);
  if (polarityRaw === undefined || !isPolarity(polarityRaw)) {
    return { ok: false, code: CONTENT_LEGAL_ERROR.INVALID_LEGAL_ACTION };
  }

  if (
    input.actionType !== CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD &&
    polarityRaw !== CONTENT_LEGAL_ACTION_POLARITY.APPLY
  ) {
    return { ok: false, code: CONTENT_LEGAL_ERROR.INVALID_LEGAL_ACTION };
  }

  const internalNote = canonicalizeRequiredNote(input.internalNote);
  if (!internalNote.ok) {
    return internalNote;
  }
  const publicNote = canonicalizeOptionalPublicNote(input.publicNote);
  if (!publicNote.ok) {
    return publicNote;
  }
  const effectiveAt = canonicalizeEffectiveAt(input.effectiveAt, input.now);
  if (!effectiveAt.ok) {
    return effectiveAt;
  }

  return {
    ok: true,
    value: {
      actionType: input.actionType,
      polarity: polarityRaw,
      reasonCategory: input.reasonCategory,
      internalNote: internalNote.value,
      publicNote: publicNote.value,
      effectiveAt: effectiveAt.value,
    },
  };
}

export function decideContentLegalAction(input: {
  item: ContentLegalItemState;
  write: ContentLegalActionWriteInput;
  now: Date;
}): ContentLegalDecision<ContentLegalActionPlan> {
  if (input.item.deletedAt !== null) {
    return { ok: false, code: CONTENT_LEGAL_ERROR.CONTENT_DELETED };
  }

  const token = assertExpectedUpdatedAt({
    currentUpdatedAt: input.item.updatedAt,
    expectedUpdatedAt: input.write.expectedUpdatedAt,
  });
  if (!token.ok) {
    return { ok: false, code: CONTENT_LEGAL_ERROR.CONTENT_WRITE_CONFLICT };
  }

  const canonical = canonicalizeContentLegalActionWrite({
    ...input.write,
    now: input.now,
  });
  if (!canonical.ok) {
    return canonical;
  }

  const write = canonical.value;
  const requiresPublicationHistory =
    write.actionType !== CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD;
  if (requiresPublicationHistory && !hasPublicationHistory(input.item)) {
    return { ok: false, code: CONTENT_LEGAL_ERROR.NOT_PUBLISHED };
  }

  let nextLegalHoldAt = cloneInstant(input.item.legalHoldAt);
  let nextLegalHoldReason = preservedHoldReason(input.item.legalHoldReason);
  let nextRetractedAt = cloneInstant(input.item.retractedAt);
  let nextTakedownAt = cloneInstant(input.item.takedownAt);

  if (write.actionType === CONTENT_LEGAL_ACTION_TYPE.RETRACTION) {
    if (input.item.retractedAt !== null) {
      return { ok: false, code: CONTENT_LEGAL_ERROR.ALREADY_RETRACTED };
    }
    nextRetractedAt = write.effectiveAt;
  }

  if (write.actionType === CONTENT_LEGAL_ACTION_TYPE.TAKEDOWN) {
    if (input.item.takedownAt !== null) {
      return { ok: false, code: CONTENT_LEGAL_ERROR.ALREADY_TAKEN_DOWN };
    }
    nextTakedownAt = write.effectiveAt;
  }

  if (write.actionType === CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD) {
    if (write.polarity === CONTENT_LEGAL_ACTION_POLARITY.APPLY) {
      if (isContentLegalHoldActive(input.item.legalHoldAt)) {
        return { ok: false, code: CONTENT_LEGAL_ERROR.LEGAL_HOLD_ALREADY_ACTIVE };
      }
      nextLegalHoldAt = write.effectiveAt;
      nextLegalHoldReason = write.reasonCategory;
    } else {
      if (!isContentLegalHoldActive(input.item.legalHoldAt)) {
        return { ok: false, code: CONTENT_LEGAL_ERROR.LEGAL_HOLD_NOT_ACTIVE };
      }
      nextLegalHoldAt = null;
      nextLegalHoldReason = null;
    }
  }

  const invalidatesPublicCache = legalActionInvalidatesPublicCache({
    actionType: write.actionType,
  });

  return {
    ok: true,
    value: {
      ...write,
      nextLegalHoldAt,
      nextLegalHoldReason,
      nextRetractedAt,
      nextTakedownAt,
      invalidatesPublicCache,
    },
  };
}

function cloneInstant(value: Date | string | null): Date | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function preservedHoldReason(
  value: string | null,
): ContentLegalReasonCategory | null {
  if (value === null) {
    return null;
  }
  return isReasonCategory(value) ? value : CONTENT_LEGAL_REASON_CATEGORY.OTHER;
}

export function contentLegalAuditEventType(input: {
  actionType: ContentLegalActionType;
  polarity: ContentLegalActionPolarity;
}):
  | "CONTENT_CORRECTION_RECORDED"
  | "CONTENT_CLARIFICATION_RECORDED"
  | "CONTENT_RETRACTED"
  | "CONTENT_TAKEN_DOWN"
  | "CONTENT_LEGAL_HOLD_PLACED"
  | "CONTENT_LEGAL_HOLD_RELEASED" {
  switch (input.actionType) {
    case CONTENT_LEGAL_ACTION_TYPE.CORRECTION:
      return "CONTENT_CORRECTION_RECORDED";
    case CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION:
      return "CONTENT_CLARIFICATION_RECORDED";
    case CONTENT_LEGAL_ACTION_TYPE.RETRACTION:
      return "CONTENT_RETRACTED";
    case CONTENT_LEGAL_ACTION_TYPE.TAKEDOWN:
      return "CONTENT_TAKEN_DOWN";
    case CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD:
      return input.polarity === CONTENT_LEGAL_ACTION_POLARITY.RELEASE
        ? "CONTENT_LEGAL_HOLD_RELEASED"
        : "CONTENT_LEGAL_HOLD_PLACED";
  }
}
