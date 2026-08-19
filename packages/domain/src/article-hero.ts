import { MEDIA_TYPE } from "./media-type";
import { MEDIA_RIGHTS_TEXT_MAX } from "./media-rights";
import { PUBLISHING_ERROR, type PublishingDecision } from "./publishing/errors";

export const ARTICLE_HERO_ALT_TEXT_MAX = 500;

function trimOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function boundedText(
  value: string | null | undefined,
  max: number,
): PublishingDecision<string | null> {
  const trimmed = trimOrNull(value);
  if (trimmed !== null && trimmed.length > max) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_RELATION };
  }
  return { ok: true, value: trimmed };
}

export function canonicalizeHeroAltText(
  value: string | null | undefined,
): PublishingDecision<string | null> {
  return boundedText(value, ARTICLE_HERO_ALT_TEXT_MAX);
}

export function canonicalizeHeroCredit(
  value: string | null | undefined,
): PublishingDecision<string | null> {
  return boundedText(value, MEDIA_RIGHTS_TEXT_MAX.CREDIT);
}

export function assertHeroAssignableMediaType(
  mediaType: string,
): PublishingDecision<true> {
  if (mediaType !== MEDIA_TYPE.IMAGE) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_HERO_MEDIA };
  }
  return { ok: true, value: true };
}

export type DraftHeroMutationInput = {
  versionId: string;
  expectedUpdatedAt: string;
  mediaId?: string;
  altText?: string | null;
  credit?: string | null;
};
