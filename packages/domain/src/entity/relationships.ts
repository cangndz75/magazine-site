import { ENTITY_ROLE, type EntityRole } from "../entity-role";
import {
  ENTITY_ERROR,
  ENTITY_STATUS,
  type EntityDecision,
  type EntityStatus,
  type EntityVersionRelation,
} from "./types";

export function entityRoleRank(role: EntityRole): number {
  switch (role) {
    case ENTITY_ROLE.SUBJECT:
      return 0;
    case ENTITY_ROLE.SECONDARY:
      return 1;
    case ENTITY_ROLE.MENTIONED:
      return 2;
  }
}

function isEntityRole(value: string): value is EntityRole {
  return (
    value === ENTITY_ROLE.SUBJECT ||
    value === ENTITY_ROLE.SECONDARY ||
    value === ENTITY_ROLE.MENTIONED
  );
}

/**
 * ContentVersion owns entity links. Draft mutation must copy-on-write the
 * version row set; published-version rows are not rewritten by draft edits.
 */
export function assertEntityVersionRelations(
  relations: readonly {
    entityId: string;
    role: string;
    sortOrder?: number;
  }[],
): EntityDecision<EntityVersionRelation[]> {
  const seen = new Set<string>();
  const canonical: EntityVersionRelation[] = [];

  for (const item of relations) {
    if (item.entityId.trim().length === 0 || seen.has(item.entityId)) {
      return { ok: false, code: ENTITY_ERROR.INVALID_RELATION };
    }
    if (!isEntityRole(item.role)) {
      return { ok: false, code: ENTITY_ERROR.INVALID_RELATION };
    }
    const sortOrder = item.sortOrder ?? canonical.length;
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      return { ok: false, code: ENTITY_ERROR.INVALID_RELATION };
    }
    seen.add(item.entityId);
    canonical.push({
      entityId: item.entityId,
      role: item.role,
      sortOrder,
    });
  }

  return { ok: true, value: canonical };
}

/**
 * v1 does not add a unique PRIMARY flag. SUBJECT is the featured role;
 * multiple SUBJECT relations on one version are allowed.
 */
export function featuredEntityIds(
  relations: readonly EntityVersionRelation[],
): string[] {
  return [...relations]
    .filter((item) => item.role === ENTITY_ROLE.SUBJECT)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => item.entityId);
}

export function publicEntityIdsForVersion(input: {
  publishedVersionId: string | null;
  draftVersionId: string | null;
  relationsByVersionId: ReadonlyMap<string, readonly EntityVersionRelation[]>;
}): string[] {
  if (input.publishedVersionId === null) {
    return [];
  }
  const published = input.relationsByVersionId.get(input.publishedVersionId) ?? [];
  return published.map((item) => item.entityId);
}

export function draftEntityRelationLeaksIntoPublic(input: {
  publishedVersionId: string | null;
  draftVersionId: string | null;
  relationsByVersionId: ReadonlyMap<string, readonly EntityVersionRelation[]>;
  entityId: string;
}): boolean {
  if (
    input.publishedVersionId === null ||
    input.draftVersionId === null ||
    input.publishedVersionId === input.draftVersionId
  ) {
    return false;
  }

  const publishedIds = new Set(
    (input.relationsByVersionId.get(input.publishedVersionId) ?? []).map(
      (item) => item.entityId,
    ),
  );
  const draftIds = new Set(
    (input.relationsByVersionId.get(input.draftVersionId) ?? []).map(
      (item) => item.entityId,
    ),
  );

  return draftIds.has(input.entityId) && !publishedIds.has(input.entityId);
}

/**
 * Linking an entity identifies a subject. It does not confirm article claims,
 * relationships, or other facts asserted in body text.
 */
export function entityRelationEndorsesArticleClaims(): boolean {
  return false;
}

export function entityMayBeAssignedToVersion(input: {
  status: EntityStatus;
  deletedAt?: Date | string | null;
  mergedIntoEntityId?: string | null;
  alreadyLinked: boolean;
}): EntityDecision<true> {
  if (input.deletedAt != null || input.mergedIntoEntityId != null) {
    return { ok: false, code: ENTITY_ERROR.INVALID_RELATION };
  }
  if (input.status === ENTITY_STATUS.ACTIVE) {
    return { ok: true, value: true };
  }
  if (input.status === ENTITY_STATUS.ARCHIVED && input.alreadyLinked) {
    return { ok: true, value: true };
  }
  return { ok: false, code: ENTITY_ERROR.INVALID_RELATION };
}
