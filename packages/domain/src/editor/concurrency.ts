import { PUBLISHING_ERROR, type PublishingDecision } from "../publishing/errors";

export function editorTimestampToEpochMs(
  value: Date | string,
): number | null {
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Compare the application-level timestamptz representation used after pg/Drizzle
 * (JS Date millisecond epoch), not raw PostgreSQL microsecond strings.
 */
export function assertExpectedUpdatedAt(input: {
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
}): PublishingDecision<true> {
  const current = editorTimestampToEpochMs(input.currentUpdatedAt);
  const expected = editorTimestampToEpochMs(input.expectedUpdatedAt);

  if (current === null || expected === null) {
    return { ok: false, code: PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT };
  }

  if (current !== expected) {
    return { ok: false, code: PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT };
  }

  return { ok: true, value: true };
}

/**
 * After ContentItem FOR UPDATE, the persisted/returned token must strictly
 * advance so two same-millisecond writes cannot reuse the previous token.
 */
export function nextMonotonicUpdatedAt(
  currentUpdatedAt: Date | string,
  now: Date = new Date(),
): Date {
  const currentMs = editorTimestampToEpochMs(currentUpdatedAt);
  if (currentMs === null) {
    return now;
  }

  if (now.getTime() > currentMs) {
    return now;
  }

  return new Date(currentMs + 1);
}
