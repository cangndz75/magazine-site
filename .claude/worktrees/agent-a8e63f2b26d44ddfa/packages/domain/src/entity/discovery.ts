import { isPublicEntityProfileEligible } from "./public-authority";
import { ENTITY_STATUS, type EntityStatus } from "./types";
import type { EntityKind } from "../entity-kind";

/**
 * Stable, engine-agnostic public discovery document for a future Search
 * phase. Not a search index. Raw DB rows must not leak into that phase.
 */
export type PublicEntityDiscoveryDocument = {
  entityId: string;
  canonicalName: string;
  aliases: string[];
  kind: EntityKind;
  currentPublicSlug: string;
  status: typeof ENTITY_STATUS.ACTIVE;
};

export function toPublicEntityDiscoveryDocument(input: {
  entityId: string;
  canonicalName: string;
  aliases: readonly string[];
  kind: EntityKind;
  slug: string;
  status: EntityStatus;
  deletedAt?: Date | string | null;
  mergedIntoEntityId?: string | null;
}): PublicEntityDiscoveryDocument | null {
  if (
    !isPublicEntityProfileEligible({
      status: input.status,
      slug: input.slug,
      deletedAt: input.deletedAt,
      mergedIntoEntityId: input.mergedIntoEntityId,
    })
  ) {
    return null;
  }

  return {
    entityId: input.entityId,
    canonicalName: input.canonicalName,
    aliases: [...input.aliases],
    kind: input.kind,
    currentPublicSlug: input.slug,
    status: ENTITY_STATUS.ACTIVE,
  };
}
