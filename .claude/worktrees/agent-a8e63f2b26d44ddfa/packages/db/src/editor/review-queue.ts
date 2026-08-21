import {
  and,
  asc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  REVIEW_EVENT_TYPE,
  WORKFLOW_STATUS,
  clampEditorListLimit,
  encodeEditorReviewQueueCursor,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentVersionAuthors,
  contentVersionCategories,
  contentVersions,
} from "../schema/content";
import { contentReviewEvents } from "../schema/review-events";
import { categories } from "../schema/taxonomy";
import {
  loadVersionAuthorSummaries,
  loadVersionCategorySummaries,
} from "./summaries";
import type {
  EditorReviewQueueFilters,
  EditorReviewQueueRow,
  EditorStaffQueryScope,
} from "./types";

const reviewPrimary = alias(
  contentVersionCategories,
  "editor_review_primary",
);
const reviewPrimaryCategory = alias(categories, "editor_review_primary_category");

export type EditorReviewQueueResult = {
  items: EditorReviewQueueRow[];
  nextCursor: string | null;
};

/**
 * Review queue lists ContentVersion rows with workflowStatus = IN_REVIEW.
 *
 * Category authorization uses that exact review version's primary category.
 *
 * Ordering is SQL-backed:
 *   COALESCE(latest SUBMITTED.created_at, content_versions.created_at) ASC,
 *   content_versions.id ASC
 *
 * Legacy IN_REVIEW rows without a SUBMITTED event remain visible and use
 * version.createdAt as a deterministic fallback. No fake SUBMITTED rows.
 */
export async function listReviewQueue(
  scope: EditorStaffQueryScope,
  filters: EditorReviewQueueFilters,
): Promise<EditorReviewQueueResult> {
  if (
    scope.scopedCategoryIds !== null &&
    scope.scopedCategoryIds.length === 0
  ) {
    return { items: [], nextCursor: null };
  }

  const db = getDb();
  const limit = clampEditorListLimit(filters.limit);
  const submittedAgg = db
    .select({
      contentVersionId: contentReviewEvents.contentVersionId,
      latestSubmittedAt: sql<Date>`max(${contentReviewEvents.createdAt})`.as(
        "latest_submitted_at",
      ),
      reviewRound: sql<number>`count(*)::int`.as("review_round"),
    })
    .from(contentReviewEvents)
    .where(eq(contentReviewEvents.eventType, REVIEW_EVENT_TYPE.SUBMITTED))
    .groupBy(contentReviewEvents.contentVersionId)
    .as("review_submitted_agg");

  const submittedAtExpr = sql`date_trunc('milliseconds', coalesce(${submittedAgg.latestSubmittedAt}, ${contentVersions.createdAt}))`;
  const conditions: SQL[] = [
    eq(contentVersions.workflowStatus, WORKFLOW_STATUS.IN_REVIEW),
    isNull(contentItems.deletedAt),
  ];

  if (scope.scopedCategoryIds !== null) {
    conditions.push(isNotNull(reviewPrimary.categoryId));
    conditions.push(
      inArray(reviewPrimary.categoryId, [...scope.scopedCategoryIds]),
    );
  }

  if (filters.publicationStatus) {
    conditions.push(
      eq(contentItems.publicationStatus, filters.publicationStatus),
    );
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const searchClause = or(
      ilike(contentItems.slug, pattern),
      ilike(contentVersions.title, pattern),
    );
    if (searchClause) {
      conditions.push(searchClause);
    }
  }

  if (filters.categoryId) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(contentVersionCategories)
          .where(
            and(
              eq(contentVersionCategories.contentVersionId, contentVersions.id),
              eq(contentVersionCategories.categoryId, filters.categoryId),
            ),
          ),
      ),
    );
  }

  if (filters.authorId) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(contentVersionAuthors)
          .where(
            and(
              eq(contentVersionAuthors.contentVersionId, contentVersions.id),
              eq(contentVersionAuthors.authorId, filters.authorId),
            ),
          ),
      ),
    );
  }

  if (filters.cursor) {
    const cursorSubmittedAt = new Date(filters.cursor.submittedAt);
    const cursorClause = or(
      sql`${submittedAtExpr} > ${cursorSubmittedAt}`,
      and(
        sql`${submittedAtExpr} = ${cursorSubmittedAt}`,
        gt(contentVersions.id, filters.cursor.id),
      ),
    );
    if (cursorClause) {
      conditions.push(cursorClause);
    }
  }

  const rows = await db
    .select({
      contentItemId: contentItems.id,
      versionId: contentVersions.id,
      versionNumber: contentVersions.versionNumber,
      slug: contentItems.slug,
      title: contentVersions.title,
      excerpt: contentVersions.excerpt,
      workflowStatus: contentVersions.workflowStatus,
      publicationStatus: contentItems.publicationStatus,
      createdAt: contentVersions.createdAt,
      latestSubmittedAt: sql<Date>`${submittedAtExpr}`.as("queue_submitted_at"),
      reviewRound: sql<number>`coalesce(${submittedAgg.reviewRound}, 0)`.as(
        "review_round",
      ),
      publishedVersionId: contentItems.publishedVersionId,
      scheduledVersionId: contentItems.scheduledVersionId,
      scheduledAt: contentItems.scheduledAt,
      primaryCategoryId: reviewPrimaryCategory.id,
      primaryCategoryName: reviewPrimaryCategory.name,
      primaryCategorySlug: reviewPrimaryCategory.slug,
    })
    .from(contentVersions)
    .innerJoin(
      contentItems,
      eq(contentItems.id, contentVersions.contentItemId),
    )
    .leftJoin(
      submittedAgg,
      eq(submittedAgg.contentVersionId, contentVersions.id),
    )
    .leftJoin(
      reviewPrimary,
      and(
        eq(reviewPrimary.contentVersionId, contentVersions.id),
        eq(reviewPrimary.isPrimary, true),
      ),
    )
    .leftJoin(
      reviewPrimaryCategory,
      eq(reviewPrimaryCategory.id, reviewPrimary.categoryId),
    )
    .where(and(...conditions))
    .orderBy(sql`${submittedAtExpr} ASC`, asc(contentVersions.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const versionIds = page.map((row) => row.versionId);
  const authorsByVersion = await loadVersionAuthorSummaries(versionIds);
  const categoriesByVersion = await loadVersionCategorySummaries(versionIds);

  const items: EditorReviewQueueRow[] = page.map((row) => {
    const versionCategories = categoriesByVersion.get(row.versionId) ?? [];
    const latestSubmittedAt =
      row.latestSubmittedAt instanceof Date
        ? row.latestSubmittedAt
        : new Date(row.latestSubmittedAt);
    const createdAt =
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    return {
      contentItemId: row.contentItemId,
      versionId: row.versionId,
      versionNumber: row.versionNumber,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      workflowStatus: row.workflowStatus,
      publicationStatus: row.publicationStatus,
      createdAt,
      latestSubmittedAt,
      reviewRound: Number(row.reviewRound),
      publishedVersionId: row.publishedVersionId,
      scheduledVersionId: row.scheduledVersionId,
      scheduledAt: row.scheduledAt,
      primaryCategory:
        row.primaryCategoryId &&
        row.primaryCategoryName &&
        row.primaryCategorySlug
          ? {
              id: row.primaryCategoryId,
              name: row.primaryCategoryName,
              slug: row.primaryCategorySlug,
            }
          : null,
      secondaryCategories: versionCategories
        .filter((category) => !category.isPrimary)
        .map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
        })),
      authors: authorsByVersion.get(row.versionId) ?? [],
    };
  });

  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      hasMore && last
        ? encodeEditorReviewQueueCursor({
            submittedAt: last.latestSubmittedAt,
            id: last.versionId,
          })
        : null,
  };
}
