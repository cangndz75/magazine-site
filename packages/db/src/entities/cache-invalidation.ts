import { and, eq, isNull } from "drizzle-orm";
import { ENTITY_STATUS, publicEntitySlugCacheTag } from "@magazine/domain";
import type { PublishingTx } from "../publishing/db-types";
import { contentVersionEntities } from "../schema/content";
import { entities, entitySlugHistory } from "../schema/entities";
import {
  enqueuePublicEntityCacheInvalidation,
  enqueuePublicEntityRelatedCacheInvalidation,
} from "../public-cache-outbox";

export async function collectEntityInvalidationSlugs(
  tx: PublishingTx,
  entityId: string,
  currentSlug: string,
): Promise<string[]> {
  const historyRows = await tx
    .select({ oldSlug: entitySlugHistory.oldSlug })
    .from(entitySlugHistory)
    .where(eq(entitySlugHistory.entityId, entityId));

  const slugs = new Set<string>([currentSlug]);
  for (const row of historyRows) {
    if (publicEntitySlugCacheTag(row.oldSlug)) {
      slugs.add(row.oldSlug);
    }
  }
  return [...slugs];
}

export async function enqueuePublicEntityProfileInvalidation(
  tx: PublishingTx,
  input: { entityId: string; slug: string; now?: Date },
): Promise<void> {
  const slugs = await collectEntityInvalidationSlugs(tx, input.entityId, input.slug);
  for (const slug of slugs) {
    await enqueuePublicEntityCacheInvalidation(tx, {
      entityId: input.entityId,
      slug,
      now: input.now,
    });
  }
}

export async function enqueuePublicEntityRelatedInvalidationForVersion(
  tx: PublishingTx,
  versionId: string,
  now?: Date,
): Promise<void> {
  const rows = await tx
    .select({
      entityId: entities.id,
      slug: entities.slug,
    })
    .from(contentVersionEntities)
    .innerJoin(entities, eq(entities.id, contentVersionEntities.entityId))
    .where(
      and(
        eq(contentVersionEntities.contentVersionId, versionId),
        eq(entities.status, ENTITY_STATUS.ACTIVE),
        isNull(entities.deletedAt),
        isNull(entities.mergedIntoEntityId),
      ),
    );

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.entityId)) {
      continue;
    }
    seen.add(row.entityId);
    await enqueuePublicEntityRelatedCacheInvalidation(tx, {
      entityId: row.entityId,
      slug: row.slug,
      now,
    });
  }
}
