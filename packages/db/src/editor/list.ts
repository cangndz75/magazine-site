import {
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  encodeEditorListCursor,
  NEWSROOM_SORT,
  NEWSROOM_VIEW,
  REVIEW_EVENT_TYPE,
  WORKFLOW_STATUS,
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
import type {
  EditorContentListFilters,
  EditorContentListRow,
  EditorStaffQueryScope,
} from "./types";
import { loadVersionAuthorSummaries } from "./summaries";
import {
  heroThumbnailForEditorItem,
  loadEditorHeroThumbnailsByVersionIds,
} from "./hero-thumbnails";
import {
  loadDraftChangesRequestedNotes,
  loadVersionEntityCounts,
} from "./newsroom-summaries";

const displayVersion = alias(contentVersions, "editor_display_version");
const displayPrimary = alias(
  contentVersionCategories,
  "editor_display_primary",
);
const primaryCategory = alias(categories, "editor_primary_category");

export type EditorContentListResult = {
  items: EditorContentListRow[];
  nextCursor: string | null;
};

export type EditorContentListOptions = {
  mediaPublicBaseUrl?: string;
};

export async function listEditorContent(
  scope: EditorStaffQueryScope,
  filters: EditorContentListFilters,
  options: EditorContentListOptions = {},
): Promise<EditorContentListResult> {
  if (
    scope.scopedCategoryIds !== null &&
    scope.scopedCategoryIds.length === 0
  ) {
    return { items: [], nextCursor: null };
  }

  const db = getDb();
  const conditions: SQL[] = [isNull(contentItems.deletedAt)];

  if (scope.scopedCategoryIds !== null) {
    conditions.push(isNotNull(displayPrimary.categoryId));
    conditions.push(
      inArray(displayPrimary.categoryId, [...scope.scopedCategoryIds]),
    );
  }

  if (filters.publicationStatus) {
    conditions.push(
      eq(contentItems.publicationStatus, filters.publicationStatus),
    );
  }

  if (filters.workflowStatus) {
    conditions.push(eq(displayVersion.workflowStatus, filters.workflowStatus));
  }

  if (filters.scheduledOnly) {
    conditions.push(isNotNull(contentItems.scheduledVersionId));
  }

  applyNewsroomViewFilter(db, conditions, filters.view);

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

  if (filters.cursor) {
    const cursorUpdatedAt = new Date(filters.cursor.updatedAt);
    const cursorClause = or(
      lt(contentItems.updatedAt, cursorUpdatedAt),
      and(
        eq(contentItems.updatedAt, cursorUpdatedAt),
        lt(contentItems.id, filters.cursor.id),
      ),
    );
    if (cursorClause) {
      conditions.push(cursorClause);
    }
  }

  const limit = filters.limit;
  const rows = await db
    .select({
      id: contentItems.id,
      contentKind: contentItems.contentKind,
      slug: contentItems.slug,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      draftVersionId: contentItems.draftVersionId,
      scheduledVersionId: contentItems.scheduledVersionId,
      scheduledAt: contentItems.scheduledAt,
      publishedAt: contentItems.publishedAt,
      publicDateModified: contentItems.publicDateModified,
      legalHoldAt: contentItems.legalHoldAt,
      retractedAt: contentItems.retractedAt,
      takedownAt: contentItems.takedownAt,
      updatedAt: contentItems.updatedAt,
      displayVersionId: displayVersion.id,
      displayVersionNumber: displayVersion.versionNumber,
      displayWorkflowStatus: displayVersion.workflowStatus,
      displayTitle: displayVersion.title,
      displayExcerpt: displayVersion.excerpt,
      primaryCategoryId: primaryCategory.id,
      primaryCategoryName: primaryCategory.name,
      primaryCategorySlug: primaryCategory.slug,
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
    .where(and(...conditions))
    .orderBy(...newsroomSortOrder(filters.sort))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const authorsByVersion = await loadVersionAuthorSummaries(
    page.map((row) => row.displayVersionId),
  );
  const changesRequestedNotes = await loadDraftChangesRequestedNotes({
    pairs: page.map((row) => ({
      contentItemId: row.id,
      draftVersionId: row.draftVersionId,
    })),
  });
  const entityCounts = await loadVersionEntityCounts(
    page.map((row) => row.displayVersionId),
  );

  const items: EditorContentListRow[] = page.map((row) => ({
    id: row.id,
    contentKind: row.contentKind,
    slug: row.slug,
    publicationStatus: row.publicationStatus,
    displayVersion: {
      id: row.displayVersionId,
      versionNumber: row.displayVersionNumber,
      workflowStatus: row.displayWorkflowStatus,
      title: row.displayTitle,
      excerpt: row.displayExcerpt,
    },
    publishedVersionId: row.publishedVersionId,
    draftVersionId: row.draftVersionId,
    scheduledVersionId: row.scheduledVersionId,
    scheduledAt: row.scheduledAt,
    publishedAt: row.publishedAt,
    publicDateModified: row.publicDateModified,
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
    authors: authorsByVersion.get(row.displayVersionId) ?? [],
    updatedAt: row.updatedAt,
    heroThumbnail: null,
    legalHoldAt: row.legalHoldAt,
    retractedAt: row.retractedAt,
    takedownAt: row.takedownAt,
    changesRequestedNote: changesRequestedNotes.get(row.id) ?? null,
    entityCount: entityCounts.get(row.displayVersionId) ?? 0,
  }));

  const thumbnailsByVersionId = await loadEditorHeroThumbnailsByVersionIds({
    versionIds: [
      ...items
        .map((item) => item.publishedVersionId)
        .filter((versionId): versionId is string => versionId !== null),
      ...items.map((item) => item.displayVersion.id),
    ],
    mediaPublicBaseUrl: options.mediaPublicBaseUrl,
  });
  for (const item of items) {
    item.heroThumbnail = heroThumbnailForEditorItem(
      {
        publicationStatus: item.publicationStatus,
        publishedVersionId: item.publishedVersionId,
        displayVersionId: item.displayVersion.id,
      },
      thumbnailsByVersionId,
    );
  }

  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      hasMore && last
        ? encodeEditorListCursor({ updatedAt: last.updatedAt, id: last.id })
        : null,
  };
}

function applyNewsroomViewFilter(
  db: ReturnType<typeof getDb>,
  conditions: SQL[],
  view: EditorContentListFilters["view"],
) {
  if (!view || view === NEWSROOM_VIEW.ALL) {
    return;
  }

  if (view === NEWSROOM_VIEW.IN_REVIEW) {
    conditions.push(eq(displayVersion.workflowStatus, WORKFLOW_STATUS.IN_REVIEW));
    return;
  }

  if (view === NEWSROOM_VIEW.SCHEDULED) {
    conditions.push(isNotNull(contentItems.scheduledVersionId));
    return;
  }

  if (view === NEWSROOM_VIEW.PUBLISHED) {
    conditions.push(eq(contentItems.publicationStatus, "PUBLISHED"));
    return;
  }

  if (view === NEWSROOM_VIEW.DRAFTS) {
    conditions.push(eq(displayVersion.workflowStatus, WORKFLOW_STATUS.DRAFT));
    return;
  }

  if (view === NEWSROOM_VIEW.ATTENTION) {
    const attentionClause = or(
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
    if (attentionClause) {
      conditions.push(attentionClause);
    }
  }
}

function newsroomSortOrder(sort: EditorContentListFilters["sort"]) {
  switch (sort) {
    case NEWSROOM_SORT.PUBLISHED_DESC:
      return [desc(contentItems.publishedAt), desc(contentItems.updatedAt), desc(contentItems.id)];
    case NEWSROOM_SORT.PUBLISHED_ASC:
      return [asc(contentItems.publishedAt), desc(contentItems.updatedAt), desc(contentItems.id)];
    case NEWSROOM_SORT.SCHEDULE_ASC:
      return [asc(contentItems.scheduledAt), desc(contentItems.updatedAt), desc(contentItems.id)];
    case NEWSROOM_SORT.UPDATED_DESC:
    default:
      return [desc(contentItems.updatedAt), desc(contentItems.id)];
  }
}
