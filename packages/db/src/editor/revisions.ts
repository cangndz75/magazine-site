import { and, desc, eq, lt, or } from "drizzle-orm";
import {
  PUBLISHING_ERROR,
  PublishingError,
  canAccessEditorContentByPrimaryCategory,
  clampEditorListLimit,
  encodeEditorRevisionCursor,
  type EditorStaffScope,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentVersions } from "../schema/content";
import { getEditorContentAccess } from "./access";
import type {
  EditorRevisionHistoryFilters,
  EditorRevisionHistoryRow,
} from "./types";

export type EditorRevisionHistoryResult = {
  contentItemId: string;
  publishedVersionId: string | null;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  versions: EditorRevisionHistoryRow[];
  nextCursor: string | null;
};

/**
 * Item-scoped revision history. Access is decided from the ContentItem
 * display-version primary category before any historical rows are returned.
 * Knowing a ContentVersion UUID is not an alternate authorization path.
 */
export async function listContentRevisionHistory(
  contentItemId: string,
  scope: EditorStaffScope,
  filters: EditorRevisionHistoryFilters,
): Promise<EditorRevisionHistoryResult> {
  const access = await getEditorContentAccess(contentItemId);
  if (!access) {
    throw new PublishingError(PUBLISHING_ERROR.CONTENT_NOT_FOUND);
  }

  if (
    !canAccessEditorContentByPrimaryCategory({
      ...scope,
      primaryCategoryId: access.displayPrimaryCategoryId,
    })
  ) {
    throw new PublishingError(PUBLISHING_ERROR.CONTENT_NOT_FOUND);
  }

  const limit = clampEditorListLimit(filters.limit);
  const db = getDb();
  const conditions = [eq(contentVersions.contentItemId, access.id)];

  if (filters.cursor) {
    const cursorClause = or(
      lt(contentVersions.versionNumber, filters.cursor.versionNumber),
      and(
        eq(contentVersions.versionNumber, filters.cursor.versionNumber),
        lt(contentVersions.id, filters.cursor.id),
      ),
    );
    if (cursorClause) {
      conditions.push(cursorClause);
    }
  }

  const rows = await db
    .select({
      id: contentVersions.id,
      contentItemId: contentVersions.contentItemId,
      versionNumber: contentVersions.versionNumber,
      workflowStatus: contentVersions.workflowStatus,
      title: contentVersions.title,
      excerpt: contentVersions.excerpt,
      createdAt: contentVersions.createdAt,
    })
    .from(contentVersions)
    .where(and(...conditions))
    .orderBy(desc(contentVersions.versionNumber), desc(contentVersions.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const versions: EditorRevisionHistoryRow[] = page.map((row) => ({
    id: row.id,
    contentItemId: row.contentItemId,
    versionNumber: row.versionNumber,
    workflowStatus: row.workflowStatus,
    title: row.title,
    excerpt: row.excerpt,
    createdAt: row.createdAt,
    isCurrentDraft: row.id === access.draftVersionId,
    isScheduledVersion: row.id === access.scheduledVersionId,
    isPublishedVersion: row.id === access.publishedVersionId,
  }));

  const last = versions[versions.length - 1];
  return {
    contentItemId: access.id,
    publishedVersionId: access.publishedVersionId,
    draftVersionId: access.draftVersionId,
    scheduledVersionId: access.scheduledVersionId,
    versions,
    nextCursor:
      hasMore && last
        ? encodeEditorRevisionCursor({
            versionNumber: last.versionNumber,
            id: last.id,
          })
        : null,
  };
}
