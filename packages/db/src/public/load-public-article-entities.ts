import { eq, inArray } from "drizzle-orm";
import {
  ENTITY_STATUS,
  publicEntityRelationVersionId,
  type EntityKind,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentVersionEntities,
} from "../schema/content";
import { entities } from "../schema/entities";

export type PublicArticleEntityLink = {
  entityId: string;
  canonicalName: string;
  slug: string;
  kind: EntityKind;
  publicHref: string | null;
};

export async function loadPublicArticleEntityLinks(input: {
  contentItemId: string;
  publishedVersionId: string;
}): Promise<PublicArticleEntityLink[]> {
  const db = getDb();
  const [item] = await db
    .select({
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      deletedAt: contentItems.deletedAt,
      retractedAt: contentItems.retractedAt,
      takedownAt: contentItems.takedownAt,
    })
    .from(contentItems)
    .where(eq(contentItems.id, input.contentItemId))
    .limit(1);

  if (!item) {
    return [];
  }

  const versionId = publicEntityRelationVersionId({
    publicationStatus: item.publicationStatus,
    publishedVersionId: item.publishedVersionId,
    relationVersionId: input.publishedVersionId,
    deletedAt: item.deletedAt,
    retractedAt: item.retractedAt,
    takedownAt: item.takedownAt,
  });
  if (versionId === null) {
    return [];
  }

  const rows = await db
    .select({
      entityId: entities.id,
      canonicalName: entities.canonicalName,
      slug: entities.slug,
      kind: entities.kind,
      status: entities.status,
      deletedAt: entities.deletedAt,
      mergedIntoEntityId: entities.mergedIntoEntityId,
      sortOrder: contentVersionEntities.sortOrder,
    })
    .from(contentVersionEntities)
    .innerJoin(entities, eq(entities.id, contentVersionEntities.entityId))
    .where(eq(contentVersionEntities.contentVersionId, versionId))
    .orderBy(contentVersionEntities.sortOrder, entities.canonicalName);

  return rows.map((row) => ({
    entityId: row.entityId,
    canonicalName: row.canonicalName,
    slug: row.slug,
    kind: row.kind as EntityKind,
    publicHref:
      row.status === ENTITY_STATUS.ACTIVE &&
      row.deletedAt === null &&
      row.mergedIntoEntityId === null
        ? `/kimdir/${row.slug}`
        : null,
  }));
}

export async function loadPublicArticleEntityLinksBatch(input: {
  items: readonly { contentItemId: string; publishedVersionId: string }[];
}): Promise<Map<string, PublicArticleEntityLink[]>> {
  const result = new Map<string, PublicArticleEntityLink[]>();
  if (input.items.length === 0) {
    return result;
  }

  const db = getDb();
  const contentItemIds = [...new Set(input.items.map((item) => item.contentItemId))];
  const itemRows = await db
    .select({
      id: contentItems.id,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      deletedAt: contentItems.deletedAt,
      retractedAt: contentItems.retractedAt,
      takedownAt: contentItems.takedownAt,
    })
    .from(contentItems)
    .where(inArray(contentItems.id, contentItemIds));

  const itemById = new Map(itemRows.map((row) => [row.id, row]));
  const versionIds = new Set<string>();
  for (const item of input.items) {
    const row = itemById.get(item.contentItemId);
    if (!row) {
      continue;
    }
    const versionId = publicEntityRelationVersionId({
      publicationStatus: row.publicationStatus,
      publishedVersionId: row.publishedVersionId,
      relationVersionId: item.publishedVersionId,
      deletedAt: row.deletedAt,
      retractedAt: row.retractedAt,
      takedownAt: row.takedownAt,
    });
    if (versionId) {
      versionIds.add(versionId);
    }
  }

  if (versionIds.size === 0) {
    return result;
  }

  const relationRows = await db
    .select({
      contentVersionId: contentVersionEntities.contentVersionId,
      entityId: entities.id,
      canonicalName: entities.canonicalName,
      slug: entities.slug,
      kind: entities.kind,
      status: entities.status,
      deletedAt: entities.deletedAt,
      mergedIntoEntityId: entities.mergedIntoEntityId,
      sortOrder: contentVersionEntities.sortOrder,
    })
    .from(contentVersionEntities)
    .innerJoin(entities, eq(entities.id, contentVersionEntities.entityId))
    .where(inArray(contentVersionEntities.contentVersionId, [...versionIds]));

  const linksByVersion = new Map<string, PublicArticleEntityLink[]>();
  for (const row of relationRows) {
    const list = linksByVersion.get(row.contentVersionId) ?? [];
    list.push({
      entityId: row.entityId,
      canonicalName: row.canonicalName,
      slug: row.slug,
      kind: row.kind as EntityKind,
      publicHref:
        row.status === ENTITY_STATUS.ACTIVE &&
        row.deletedAt === null &&
        row.mergedIntoEntityId === null
          ? `/kimdir/${row.slug}`
          : null,
    });
    linksByVersion.set(row.contentVersionId, list);
  }

  for (const item of input.items) {
    const row = itemById.get(item.contentItemId);
    if (!row) {
      result.set(item.contentItemId, []);
      continue;
    }
    const versionId = publicEntityRelationVersionId({
      publicationStatus: row.publicationStatus,
      publishedVersionId: row.publishedVersionId,
      relationVersionId: item.publishedVersionId,
      deletedAt: row.deletedAt,
      retractedAt: row.retractedAt,
      takedownAt: row.takedownAt,
    });
    result.set(item.contentItemId, versionId ? linksByVersion.get(versionId) ?? [] : []);
  }

  return result;
}
