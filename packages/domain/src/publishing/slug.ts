import { PUBLISHING_ERROR, type PublishingDecision } from "./errors";

export const CONTENT_SLUG_MAX_LENGTH = 200;
export const CONTENT_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function canonicalizeContentSlug(
  raw: string,
): PublishingDecision<string> {
  const slug = raw.trim().toLowerCase();

  if (
    slug.length < 1 ||
    slug.length > CONTENT_SLUG_MAX_LENGTH ||
    !CONTENT_SLUG_PATTERN.test(slug)
  ) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_SLUG };
  }

  return { ok: true, value: slug };
}
