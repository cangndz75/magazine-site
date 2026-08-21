import { ENTITY_KIND, type EntityKind } from "../entity-kind";
import { ENTITY_ROLE, type EntityRole } from "../entity-role";

export const ENTITY_STATUS = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;

export type EntityStatus = (typeof ENTITY_STATUS)[keyof typeof ENTITY_STATUS];

export const ENTITY_STATUSES = [
  ENTITY_STATUS.DRAFT,
  ENTITY_STATUS.ACTIVE,
  ENTITY_STATUS.ARCHIVED,
] as const;

export const ENTITY_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  ENTITY_NOT_FOUND: "ENTITY_NOT_FOUND",
  ENTITY_WRITE_CONFLICT: "ENTITY_WRITE_CONFLICT",
  ENTITY_DELETED: "ENTITY_DELETED",
  INVALID_NAME: "INVALID_NAME",
  INVALID_SLUG: "INVALID_SLUG",
  SLUG_CONFLICT: "SLUG_CONFLICT",
  INVALID_ALIAS: "INVALID_ALIAS",
  DUPLICATE_ALIAS: "DUPLICATE_ALIAS",
  ALIAS_LIMIT: "ALIAS_LIMIT",
  INVALID_STATUS: "INVALID_STATUS",
  INVALID_KIND: "INVALID_KIND",
  INVALID_PROFILE: "INVALID_PROFILE",
  INVALID_URL: "INVALID_URL",
  INVALID_MEDIA: "INVALID_MEDIA",
  INVALID_RELATION: "INVALID_RELATION",
  INVALID_MERGE: "INVALID_MERGE",
} as const;

export type EntityErrorCode = (typeof ENTITY_ERROR)[keyof typeof ENTITY_ERROR];

export class EntityError extends Error {
  readonly code: EntityErrorCode;

  constructor(code: EntityErrorCode, message: string = code) {
    super(message);
    this.name = "EntityError";
    this.code = code;
  }
}

export type EntityDecision<T> =
  | { ok: true; value: T }
  | { ok: false; code: EntityErrorCode };

export const ENTITY_TEXT_MAX = {
  CANONICAL_NAME: 200,
  SLUG: 200,
  ALIAS: 200,
  SUMMARY: 500,
  BIOGRAPHY: 4000,
  OCCUPATION: 200,
} as const;

export const ENTITY_ALIAS_MAX_COUNT = 20;

export const ENTITY_RELATED_STORIES_DEFAULT_LIMIT = 20;
export const ENTITY_RELATED_STORIES_MAX_LIMIT = 50;

/**
 * Durable identity is entityId. Names, slugs, and aliases are mutable labels.
 */
export type EntityIdentity = {
  entityId: string;
};

export type EntityAliasRecord = {
  aliasId: string;
  display: string;
  searchKey: string;
};

export type CanonicalEntityProfile = {
  entityId: string;
  kind: EntityKind;
  status: EntityStatus;
  canonicalName: string;
  slug: string;
  summary: string | null;
  biography: string | null;
  portraitMediaId: string | null;
  birthDate: string | null;
  occupation: string | null;
  officialWebsiteUrl: string | null;
  aliases: readonly EntityAliasRecord[];
  mergedIntoEntityId: string | null;
  deletedAt: Date | null;
  updatedAt: Date;
};

export type EntityProfileWriteInput = {
  kind: string;
  canonicalName: string;
  slug: string;
  status?: string;
  summary?: string | null;
  biography?: string | null;
  portraitMediaId?: string | null;
  birthDate?: string | null;
  occupation?: string | null;
  officialWebsiteUrl?: string | null;
  aliases?: readonly string[];
};

export type CanonicalEntityProfileWrite = {
  kind: EntityKind;
  status: EntityStatus;
  canonicalName: string;
  slug: string;
  summary: string | null;
  biography: string | null;
  portraitMediaId: string | null;
  birthDate: string | null;
  occupation: string | null;
  officialWebsiteUrl: string | null;
  aliases: readonly {
    display: string;
    searchKey: string;
  }[];
};

export type EntityVersionRelation = {
  entityId: string;
  role: EntityRole;
  sortOrder: number;
};

export const ENTITY_KIND_JSON_LD_TYPE = {
  [ENTITY_KIND.PERSON]: "Person",
  [ENTITY_KIND.ORGANIZATION]: "Organization",
  [ENTITY_KIND.BRAND]: "Brand",
  [ENTITY_KIND.PRODUCTION]: "CreativeWork",
  [ENTITY_KIND.PLACE]: "Place",
  [ENTITY_KIND.EVENT]: "Event",
} as const;

export type EntityJsonLdType =
  (typeof ENTITY_KIND_JSON_LD_TYPE)[EntityKind];

export { ENTITY_KIND, ENTITY_ROLE };
export type { EntityKind, EntityRole };
