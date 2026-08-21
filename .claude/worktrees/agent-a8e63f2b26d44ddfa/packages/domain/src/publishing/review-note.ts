import { PUBLISHING_ERROR, type PublishingDecision } from "./errors";

export const REVIEW_NOTE_MIN_LENGTH = 3;
export const REVIEW_NOTE_MAX_LENGTH = 4000;

export function canonicalizeOptionalReviewNote(
  raw: string | null | undefined,
): PublishingDecision<string | null> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }

  const note = raw.trim();
  if (note.length === 0) {
    return { ok: true, value: null };
  }

  if (note.length < REVIEW_NOTE_MIN_LENGTH || note.length > REVIEW_NOTE_MAX_LENGTH) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_REVIEW_NOTE };
  }

  return { ok: true, value: note };
}

export function canonicalizeRequiredReviewNote(
  raw: string | null | undefined,
): PublishingDecision<string> {
  if (raw === undefined || raw === null) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_REVIEW_NOTE };
  }

  const note = raw.trim();
  if (note.length < REVIEW_NOTE_MIN_LENGTH || note.length > REVIEW_NOTE_MAX_LENGTH) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_REVIEW_NOTE };
  }

  return { ok: true, value: note };
}
