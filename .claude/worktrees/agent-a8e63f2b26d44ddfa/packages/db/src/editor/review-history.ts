import { and, asc, eq } from "drizzle-orm";
import {
  PUBLISHING_ERROR,
  PublishingError,
  canAccessEditorContentByPrimaryCategory,
  type EditorStaffScope,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentReviewEvents } from "../schema/review-events";
import { staffUsers } from "../schema/staff";
import { getEditorContentAccess } from "./access";
import type {
  EditorReviewHistoryFilters,
  EditorReviewHistoryRow,
} from "./types";

export type EditorReviewHistoryResult = {
  contentItemId: string;
  events: EditorReviewHistoryRow[];
};

const REVIEW_HISTORY_MAX = 200;

/**
 * Item-scoped review lifecycle history. Access matches revision history:
 * display-version primary category, never a client-supplied scope, and
 * never an event/version UUID as an alternate authorization path.
 */
export async function listContentReviewHistory(
  contentItemId: string,
  scope: EditorStaffScope,
  filters: EditorReviewHistoryFilters = {},
): Promise<EditorReviewHistoryResult> {
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

  const db = getDb();
  const conditions = [eq(contentReviewEvents.contentItemId, access.id)];
  if (filters.versionId) {
    conditions.push(eq(contentReviewEvents.contentVersionId, filters.versionId));
  }

  const rows = await db
    .select({
      id: contentReviewEvents.id,
      contentItemId: contentReviewEvents.contentItemId,
      contentVersionId: contentReviewEvents.contentVersionId,
      eventType: contentReviewEvents.eventType,
      note: contentReviewEvents.note,
      createdAt: contentReviewEvents.createdAt,
      actorId: staffUsers.id,
      actorDisplayName: staffUsers.displayName,
    })
    .from(contentReviewEvents)
    .innerJoin(staffUsers, eq(staffUsers.id, contentReviewEvents.actorId))
    .where(and(...conditions))
    .orderBy(asc(contentReviewEvents.createdAt), asc(contentReviewEvents.id))
    .limit(REVIEW_HISTORY_MAX);

  return {
    contentItemId: access.id,
    events: rows.map((row) => ({
      id: row.id,
      contentItemId: row.contentItemId,
      contentVersionId: row.contentVersionId,
      eventType: row.eventType,
      actor: {
        id: row.actorId,
        displayName: row.actorDisplayName,
      },
      note: row.note,
      createdAt: row.createdAt,
    })),
  };
}
