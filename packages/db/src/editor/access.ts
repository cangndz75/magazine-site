import { eq, inArray } from "drizzle-orm";
import {
  getPrimaryCategoryId,
  selectEditorDisplayVersionId,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentVersionCategories,
  contentVersions,
} from "../schema/content";
import type { EditorContentAccess, OwnedVersionCategories } from "./types";

async function loadCategoryRows(versionIds: string[]) {
  if (versionIds.length === 0) {
    return [];
  }

  const db = getDb();
  return db
    .select({
      contentVersionId: contentVersionCategories.contentVersionId,
      categoryId: contentVersionCategories.categoryId,
      isPrimary: contentVersionCategories.isPrimary,
    })
    .from(contentVersionCategories)
    .where(inArray(contentVersionCategories.contentVersionId, versionIds));
}

function categoriesFor(
  rows: { contentVersionId: string; categoryId: string; isPrimary: boolean }[],
  versionId: string | null,
): { categoryId: string; isPrimary: boolean }[] {
  if (!versionId) {
    return [];
  }

  return rows
    .filter((row) => row.contentVersionId === versionId)
    .map((row) => ({
      categoryId: row.categoryId,
      isPrimary: row.isPrimary,
    }));
}

export async function getEditorContentAccess(
  contentItemId: string,
): Promise<EditorContentAccess | null> {
  const db = getDb();
  const [item] = await db
    .select({
      id: contentItems.id,
      updatedAt: contentItems.updatedAt,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      draftVersionId: contentItems.draftVersionId,
      scheduledVersionId: contentItems.scheduledVersionId,
      scheduledAt: contentItems.scheduledAt,
      scheduleGeneration: contentItems.scheduleGeneration,
      deletedAt: contentItems.deletedAt,
    })
    .from(contentItems)
    .where(eq(contentItems.id, contentItemId))
    .limit(1);

  if (!item || item.deletedAt !== null) {
    return null;
  }

  const displayVersionId = selectEditorDisplayVersionId(item);
  const versionIds = [
    item.draftVersionId,
    item.scheduledVersionId,
    item.publishedVersionId,
  ].filter((id): id is string => id !== null);

  const rows = await loadCategoryRows(versionIds);
  const displayCategories = categoriesFor(rows, displayVersionId);
  const draftCategories = categoriesFor(rows, item.draftVersionId);
  const publishedCategories = categoriesFor(rows, item.publishedVersionId);
  const scheduledCategories = categoriesFor(rows, item.scheduledVersionId);

  return {
    id: item.id,
    updatedAt: item.updatedAt,
    publicationStatus: item.publicationStatus,
    publishedVersionId: item.publishedVersionId,
    draftVersionId: item.draftVersionId,
    scheduledVersionId: item.scheduledVersionId,
    scheduledAt: item.scheduledAt,
    scheduleGeneration: item.scheduleGeneration,
    displayVersionId,
    displayPrimaryCategoryId: getPrimaryCategoryId(displayCategories),
    displayCategoryIds: displayCategories.map((row) => row.categoryId),
    draftPrimaryCategoryId: getPrimaryCategoryId(draftCategories),
    draftCategoryIds: draftCategories.map((row) => row.categoryId),
    publishedPrimaryCategoryId: getPrimaryCategoryId(publishedCategories),
    publishedCategoryIds: publishedCategories.map((row) => row.categoryId),
    scheduledPrimaryCategoryId: getPrimaryCategoryId(scheduledCategories),
    scheduledCategoryIds: scheduledCategories.map((row) => row.categoryId),
  };
}

export async function getOwnedVersionCategories(
  contentItemId: string,
  versionId: string,
): Promise<OwnedVersionCategories | null> {
  const db = getDb();
  const [version] = await db
    .select({
      id: contentVersions.id,
      contentItemId: contentVersions.contentItemId,
    })
    .from(contentVersions)
    .where(eq(contentVersions.id, versionId))
    .limit(1);

  if (!version || version.contentItemId !== contentItemId) {
    return null;
  }

  const rows = await loadCategoryRows([version.id]);
  const mapped = rows.map((row) => ({
    categoryId: row.categoryId,
    isPrimary: row.isPrimary,
  }));

  return {
    versionId: version.id,
    primaryCategoryId: getPrimaryCategoryId(mapped),
    categoryIds: mapped.map((row) => row.categoryId),
  };
}
