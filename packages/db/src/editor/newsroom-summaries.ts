import { desc, inArray, sql } from "drizzle-orm";
import { REVIEW_EVENT_TYPE } from "@magazine/domain";
import { getDb } from "../client";
import { contentVersionEntities } from "../schema/content";
import { contentReviewEvents } from "../schema/review-events";

export async function loadDraftChangesRequestedNotes(input: {
  pairs: readonly { contentItemId: string; draftVersionId: string | null }[];
}): Promise<Map<string, string>> {
  const versionIds = [
    ...new Set(
      input.pairs
        .map((pair) => pair.draftVersionId)
        .filter((versionId): versionId is string => versionId !== null),
    ),
  ];
  const notes = new Map<string, string>();
  if (versionIds.length === 0) {
    return notes;
  }

  const db = getDb();
  const rows = await db
    .select({
      contentItemId: contentReviewEvents.contentItemId,
      contentVersionId: contentReviewEvents.contentVersionId,
      eventType: contentReviewEvents.eventType,
      note: contentReviewEvents.note,
      createdAt: contentReviewEvents.createdAt,
    })
    .from(contentReviewEvents)
    .where(inArray(contentReviewEvents.contentVersionId, versionIds))
    .orderBy(desc(contentReviewEvents.createdAt));

  const latestByVersion = new Map<
    string,
    { eventType: string; note: string | null; contentItemId: string }
  >();
  for (const row of rows) {
    if (!latestByVersion.has(row.contentVersionId)) {
      latestByVersion.set(row.contentVersionId, row);
    }
  }

  for (const pair of input.pairs) {
    if (!pair.draftVersionId) {
      continue;
    }
    const latest = latestByVersion.get(pair.draftVersionId);
    if (
      latest &&
      latest.eventType === REVIEW_EVENT_TYPE.CHANGES_REQUESTED &&
      latest.note
    ) {
      notes.set(pair.contentItemId, latest.note);
    }
  }

  return notes;
}

export async function loadVersionEntityCounts(
  versionIds: readonly string[],
): Promise<Map<string, number>> {
  const ids = [...new Set(versionIds.filter((id) => id.length > 0))];
  const counts = new Map<string, number>();
  if (ids.length === 0) {
    return counts;
  }

  const db = getDb();
  const rows = await db
    .select({
      contentVersionId: contentVersionEntities.contentVersionId,
      count: sql<number>`count(*)::int`.as("entity_count"),
    })
    .from(contentVersionEntities)
    .where(inArray(contentVersionEntities.contentVersionId, ids))
    .groupBy(contentVersionEntities.contentVersionId);

  for (const row of rows) {
    counts.set(row.contentVersionId, Number(row.count));
  }

  return counts;
}
