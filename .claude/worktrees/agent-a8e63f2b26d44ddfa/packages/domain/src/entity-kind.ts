/**
 * Canonical editorial entity type. Bounded enum — not a free-form string.
 * PERSON is the magazine v1 workhorse; ORGANIZATION/BRAND/PRODUCTION cover
 * typical subject linking. PLACE and EVENT already exist on the Postgres
 * `entity_kind` enum and must not be silently dropped.
 */
export const ENTITY_KIND = {
  PERSON: "PERSON",
  ORGANIZATION: "ORGANIZATION",
  BRAND: "BRAND",
  PRODUCTION: "PRODUCTION",
  PLACE: "PLACE",
  EVENT: "EVENT",
} as const;

export type EntityKind = (typeof ENTITY_KIND)[keyof typeof ENTITY_KIND];

export const ENTITY_KINDS = [
  ENTITY_KIND.PERSON,
  ENTITY_KIND.ORGANIZATION,
  ENTITY_KIND.BRAND,
  ENTITY_KIND.PRODUCTION,
  ENTITY_KIND.PLACE,
  ENTITY_KIND.EVENT,
] as const;
