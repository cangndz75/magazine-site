import { CONTENT_SLUG_MAX_LENGTH, CONTENT_SLUG_PATTERN } from "../publishing/slug";
import { publicSiteBaseUrl } from "../seo/canonical";
import {
  ENTITY_ERROR,
  ENTITY_TEXT_MAX,
  type EntityDecision,
  type EntityIdentity,
} from "./types";

export const ENTITY_SLUG_MAX_LENGTH = CONTENT_SLUG_MAX_LENGTH;
export const ENTITY_SLUG_PATTERN = CONTENT_SLUG_PATTERN;

export const PUBLIC_ENTITY_PROFILE_PATH_PREFIX = "/kimdir";

const WHITESPACE = /\s+/g;
const SLUG_UNSAFE = /[/?#\\]/;

function compactUnicodeText(raw: string): string {
  return raw.normalize("NFC").replace(WHITESPACE, " ").trim();
}

/**
 * Display name: required, trimmed, Unicode-preserving. Never lowercased
 * or ASCII-folded — Turkish names keep ı/İ/ş/ğ/ü/ö/ç.
 */
export function canonicalizeEntityCanonicalName(
  raw: string,
): EntityDecision<string> {
  const name = compactUnicodeText(raw);
  if (name.length < 1 || name.length > ENTITY_TEXT_MAX.CANONICAL_NAME) {
    return { ok: false, code: ENTITY_ERROR.INVALID_NAME };
  }
  return { ok: true, value: name };
}

/**
 * Current public slug is a mutable label in the entity namespace.
 * It is not relational identity.
 */
export function canonicalizeEntitySlug(raw: string): EntityDecision<string> {
  if (SLUG_UNSAFE.test(raw) || raw.includes("://") || raw.includes("..")) {
    return { ok: false, code: ENTITY_ERROR.INVALID_SLUG };
  }

  const slug = raw.trim().toLowerCase();
  if (
    slug.length < 1 ||
    slug.length > ENTITY_SLUG_MAX_LENGTH ||
    !ENTITY_SLUG_PATTERN.test(slug)
  ) {
    return { ok: false, code: ENTITY_ERROR.INVALID_SLUG };
  }

  return { ok: true, value: slug };
}

export function entityIdentityEquals(
  left: EntityIdentity,
  right: EntityIdentity,
): boolean {
  return left.entityId === right.entityId;
}

export type EntitySlugOccupancy = {
  currentSlugEntityId: string | null;
  historicalSlugEntityId: string | null;
};

/**
 * Future slug-history occupancy. Another entity cannot claim a current or
 * historical slug. The same entity may reclaim its own previous slug.
 */
export function entitySlugIsAvailable(input: {
  entityId: string;
  occupancy: EntitySlugOccupancy;
}): boolean {
  const current = input.occupancy.currentSlugEntityId;
  const historical = input.occupancy.historicalSlugEntityId;
  if (current !== null && current !== input.entityId) {
    return false;
  }
  if (historical !== null && historical !== input.entityId) {
    return false;
  }
  return true;
}

export type PublicEntityCanonicalInput = {
  trustedSiteUrl: string;
  slug: string;
};

export function decidePublicEntityCanonicalUrl(
  input: PublicEntityCanonicalInput,
): EntityDecision<string> {
  let origin: string;
  try {
    origin = publicSiteBaseUrl(input.trustedSiteUrl);
  } catch {
    return { ok: false, code: ENTITY_ERROR.INVALID_URL };
  }

  const slug = canonicalizeEntitySlug(input.slug);
  if (!slug.ok) {
    return slug;
  }

  return {
    ok: true,
    value: `${origin}${PUBLIC_ENTITY_PROFILE_PATH_PREFIX}/${encodeURIComponent(slug.value)}`,
  };
}

export function publicEntityCanonicalUrl(
  trustedSiteUrl: string,
  slug: string,
): string {
  const decided = decidePublicEntityCanonicalUrl({ trustedSiteUrl, slug });
  if (!decided.ok) {
    throw new Error(decided.code);
  }
  return decided.value;
}
