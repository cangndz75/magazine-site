import {
  and,
  eq,
  exists,
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
  type NewsroomViewCounts,
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
import type { EditorContentListFilters, EditorStaffQueryScope } from "./types";

const displayVersion = alias(contentVersions, "editor_display_version");
const displayPrimary = alias(
  contentVersionCategories,
  "editor_display_primary",
);
const primaryCategory = alias(categories, "editor_primary_category");

export async function getNewsroomViewCounts(
  scope: EditorStaffQueryScope,
  filters: Omit<EditorContentListFilters, "view" | "cursor" | "limit" | "sort">,
): Promise<NewsroomViewCounts> {
  if (
    scope.scopedCategoryIds !== null &&
    scope.scopedCategoryIds.length === 0
  ) {
    return emptyCounts();
  }

  const db = getDb();
  const conditions = buildSharedListConditions(db, scope, filters);
  const attentionClause = buildAttentionClause(db);

  const [row] = await db
    .select({
      all: sql<number>`count(*)::int`.as("all_count"),
      inReview:
        sql<number>`count(*) filter (where ${displayVersion.workflowStatus} = ${WORKFLOW_STATUS.IN_REVIEW})::int`.as(
          "in_review_count",
        ),
      scheduled:
        sql<number>`count(*) filter (where ${contentItems.scheduledVersionId} IS NOT NULL)::int`.as(
          "scheduled_count",
        ),
      published:
        sql<number>`count(*) filter (where ${contentItems.publicationStatus} = 'PUBLISHED')::int`.as(
          "published_count",
        ),
      drafts:
        sql<number>`count(*) filter (where ${displayVersion.workflowStatus} = ${WORKFLOW_STATUS.DRAFT})::int`.as(
          "drafts_count",
        ),
      attention:
        sql<number>`count(*) filter (where ${attentionClause ?? sql`false`})::int`.as(
          "attention_count",
        ),
    })
    .from(contentItems)
    .innerJoin(
      displayVersion,
      sql`${displayVersion.id} = coalesce(${contentItems.draftVersionId}, ${contentItems.scheduledVersionId}, ${contentItems.publishedVersionId})`,
    )
    .leftJoin(
      displayPrimary,
      and(
        eq(displayPrimary.contentVersionId, displayVersion.id),
        eq(displayPrimary.isPrimary, true),
      ),
    )
    .leftJoin(primaryCategory, eq(primaryCategory.id, displayPrimary.categoryId))
    .where(and(...conditions));

  return {
    all: Number(row?.all ?? 0),
    inReview: Number(row?.inReview ?? 0),
    scheduled: Number(row?.scheduled ?? 0),
    published: Number(row?.published ?? 0),
    drafts: Number(row?.drafts ?? 0),
    attention: Number(row?.attention ?? 0),
  };
}

function buildSharedListConditions(
  db: ReturnType<typeof getDb>,
  scope: EditorStaffQueryScope,
  filters: Omit<EditorContentListFilters, "view" | "cursor" | "limit" | "sort">,
): SQL[] {
  const conditions: SQL[] = [isNull(contentItems.deletedAt)];

  if (scope.scopedCategoryIds !== null) {
    conditions.push(isNotNull(displayPrimary.categoryId));
    conditions.push(
      inArray(displayPrimary.categoryId, [...scope.scopedCategoryIds]),
    );
  }

  if (filters.publicationStatus) {
    conditions.push(eq(contentItems.publicationStatus, filters.publicationStatus));
  }
  if (filters.workflowStatus) {
    conditions.push(eq(displayVersion.workflowStatus, filters.workflowStatus));
  }
  if (filters.scheduledOnly) {
    conditions.push(isNotNull(contentItems.scheduledVersionId));
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const searchClause = or(
      ilike(contentItems.slug, pattern),
      ilike(displayVersion.title, pattern),
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
              eq(contentVersionCategories.contentVersionId, displayVersion.id),
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
              eq(contentVersionAuthors.contentVersionId, displayVersion.id),
              eq(contentVersionAuthors.authorId, filters.authorId),
            ),
          ),
      ),
    );
  }

  return conditions;
}

function buildAttentionClause(db: ReturnType<typeof getDb>) {
  return or(
    isNotNull(contentItems.legalHoldAt),
    isNotNull(contentItems.retractedAt),
    isNotNull(contentItems.takedownAt),
    and(
      eq(displayVersion.workflowStatus, WORKFLOW_STATUS.APPROVED),
      isNull(displayPrimary.categoryId),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(contentReviewEvents)
        .where(
          and(
            eq(contentReviewEvents.contentItemId, contentItems.id),
            eq(contentReviewEvents.contentVersionId, contentItems.draftVersionId),
            eq(contentReviewEvents.eventType, REVIEW_EVENT_TYPE.CHANGES_REQUESTED),
          ),
        ),
    ),
  );
}

function emptyCounts(): NewsroomViewCounts {
  return {
    all: 0,
    attention: 0,
    inReview: 0,
    scheduled: 0,
    published: 0,
    drafts: 0,
  };
}
