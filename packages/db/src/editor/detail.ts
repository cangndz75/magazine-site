import { eq, inArray } from "drizzle-orm";
import { selectEditorDisplayVersionId } from "@magazine/domain";
import { getDb } from "../client";
import { authors } from "../schema/authors";
import {
  contentItems,
  contentVersionAuthors,
  contentVersionCategories,
  contentVersionEntities,
  contentVersionMedia,
  contentVersionTags,
  contentVersions,
} from "../schema/content";
import { entities } from "../schema/entities";
import { media } from "../schema/media";
import { categories, tags } from "../schema/taxonomy";
import type {
  EditorContentDetail,
  EditorVersionSummary,
} from "./types";

export async function getEditorContentDetail(
  contentItemId: string,
): Promise<EditorContentDetail | null> {
  const db = getDb();
  const [item] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, contentItemId))
    .limit(1);

  if (!item || item.deletedAt !== null) {
    return null;
  }

  const displayVersionId = selectEditorDisplayVersionId(item);
  const pointerIds = [
    item.publishedVersionId,
    item.draftVersionId,
    item.scheduledVersionId,
  ].filter((id): id is string => id !== null);

  const summaryRows =
    pointerIds.length === 0
      ? []
      : await db
          .select({
            id: contentVersions.id,
            versionNumber: contentVersions.versionNumber,
            workflowStatus: contentVersions.workflowStatus,
            title: contentVersions.title,
          })
          .from(contentVersions)
          .where(inArray(contentVersions.id, pointerIds));

  const summaries = new Map(
    summaryRows.map((row) => [row.id, row satisfies EditorVersionSummary]),
  );

  const currentVersion = displayVersionId
    ? await loadCurrentVersion(displayVersionId)
    : null;

  return {
    id: item.id,
    slug: item.slug,
    publicationStatus: item.publicationStatus,
    publishedVersionId: item.publishedVersionId,
    draftVersionId: item.draftVersionId,
    scheduledVersionId: item.scheduledVersionId,
    scheduledAt: item.scheduledAt,
    scheduleGeneration: item.scheduleGeneration,
    publishedAt: item.publishedAt,
    publicDateModified: item.publicDateModified,
    updatedAt: item.updatedAt,
    currentVersion,
    publishedVersion: item.publishedVersionId
      ? (summaries.get(item.publishedVersionId) ?? null)
      : null,
    draftVersion: item.draftVersionId
      ? (summaries.get(item.draftVersionId) ?? null)
      : null,
    scheduledVersion: item.scheduledVersionId
      ? (summaries.get(item.scheduledVersionId) ?? null)
      : null,
  };
}

async function loadCurrentVersion(
  versionId: string,
): Promise<EditorContentDetail["currentVersion"]> {
  const db = getDb();
  const [version] = await db
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.id, versionId))
    .limit(1);

  if (!version) {
    return null;
  }

  const [categoryRows, tagRows, entityRows, mediaRows, authorRows] =
    await Promise.all([
      db
        .select({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          isPrimary: contentVersionCategories.isPrimary,
        })
        .from(contentVersionCategories)
        .innerJoin(
          categories,
          eq(categories.id, contentVersionCategories.categoryId),
        )
        .where(eq(contentVersionCategories.contentVersionId, versionId)),
      db
        .select({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
        })
        .from(contentVersionTags)
        .innerJoin(tags, eq(tags.id, contentVersionTags.tagId))
        .where(eq(contentVersionTags.contentVersionId, versionId)),
      db
        .select({
          id: entities.id,
          name: entities.canonicalName,
          kind: entities.kind,
          role: contentVersionEntities.role,
          sortOrder: contentVersionEntities.sortOrder,
        })
        .from(contentVersionEntities)
        .innerJoin(
          entities,
          eq(entities.id, contentVersionEntities.entityId),
        )
        .where(eq(contentVersionEntities.contentVersionId, versionId)),
      db
        .select({
          id: media.id,
          mediaType: media.mediaType,
          storageKey: media.storageKey,
          width: media.width,
          height: media.height,
          role: contentVersionMedia.role,
          sortOrder: contentVersionMedia.sortOrder,
          caption: contentVersionMedia.caption,
          altText: contentVersionMedia.altText,
          credit: contentVersionMedia.credit,
        })
        .from(contentVersionMedia)
        .innerJoin(media, eq(media.id, contentVersionMedia.mediaId))
        .where(eq(contentVersionMedia.contentVersionId, versionId)),
      db
        .select({
          id: authors.id,
          displayName: authors.displayName,
          slug: authors.slug,
          role: contentVersionAuthors.role,
          sortOrder: contentVersionAuthors.sortOrder,
        })
        .from(contentVersionAuthors)
        .innerJoin(authors, eq(authors.id, contentVersionAuthors.authorId))
        .where(eq(contentVersionAuthors.contentVersionId, versionId)),
    ]);

  return {
    id: version.id,
    versionNumber: version.versionNumber,
    workflowStatus: version.workflowStatus,
    title: version.title,
    subtitle: version.subtitle,
    excerpt: version.excerpt,
    body: version.body,
    seoTitle: version.seoTitle,
    seoDescription: version.seoDescription,
    canonicalUrl: version.canonicalUrl,
    robots: version.robots,
    credibility: version.credibility,
    credibilitySource: version.credibilitySource,
    source: version.source,
    sourceOrganization: version.sourceOrganization,
    sourceUrl: version.sourceUrl,
    syndicated: version.syndicated,
    isMaterialUpdate: version.isMaterialUpdate,
    createdAt: version.createdAt,
    categories: categoryRows,
    tags: tagRows,
    entities: entityRows,
    media: mediaRows,
    authors: authorRows,
  };
}
