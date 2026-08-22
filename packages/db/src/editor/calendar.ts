import {
  and,
  asc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "../client";
import {
  contentItems,
  contentVersionAuthors,
  contentVersionCategories,
  contentVersions,
} from "../schema/content";
import { categories } from "../schema/taxonomy";
import {
  loadVersionAuthorSummaries,
  loadVersionCategorySummaries,
} from "./summaries";
import type {
  EditorCalendarFilters,
  EditorCalendarItem,
  EditorCalendarResult,
  EditorStaffQueryScope,
} from "./types";

const scheduledVersion = alias(contentVersions, "editor_calendar_scheduled");
const scheduledPrimary = alias(
  contentVersionCategories,
  "editor_calendar_primary",
);
const scheduledPrimaryCategory = alias(
  categories,
  "editor_calendar_primary_category",
);

export async function listEditorCalendarItems(
  scope: EditorStaffQueryScope,
  filters: EditorCalendarFilters,
  now: Date = new Date(),
): Promise<EditorCalendarResult> {
  if (
    scope.scopedCategoryIds !== null &&
    scope.scopedCategoryIds.length === 0
  ) {
    return emptyResult();
  }

  const db = getDb();
  const conditions: SQL[] = [
    isNull(contentItems.deletedAt),
    isNotNull(contentItems.scheduledVersionId),
    isNotNull(contentItems.scheduledAt),
    gte(contentItems.scheduledAt, filters.start),
    lt(contentItems.scheduledAt, filters.end),
  ];

  if (scope.scopedCategoryIds !== null) {
    conditions.push(isNotNull(scheduledPrimary.categoryId));
    conditions.push(
      inArray(scheduledPrimary.categoryId, [...scope.scopedCategoryIds]),
    );
  }

  if (filters.categoryId) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(contentVersionCategories)
          .where(
            and(
              eq(contentVersionCategories.contentVersionId, scheduledVersion.id),
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
              eq(contentVersionAuthors.contentVersionId, scheduledVersion.id),
              eq(contentVersionAuthors.authorId, filters.authorId),
            ),
          ),
      ),
    );
  }

  if (filters.contentKind) {
    conditions.push(eq(contentItems.contentKind, filters.contentKind));
  }

  const rows = await db
    .select({
      contentItemId: contentItems.id,
      slug: contentItems.slug,
      contentKind: contentItems.contentKind,
      publicationStatus: contentItems.publicationStatus,
      scheduledVersionId: contentItems.scheduledVersionId,
      scheduledAt: contentItems.scheduledAt,
      scheduleGeneration: contentItems.scheduleGeneration,
      versionId: scheduledVersion.id,
      workflowStatus: scheduledVersion.workflowStatus,
      title: scheduledVersion.title,
      primaryCategoryId: scheduledPrimaryCategory.id,
      primaryCategoryName: scheduledPrimaryCategory.name,
      primaryCategorySlug: scheduledPrimaryCategory.slug,
    })
    .from(contentItems)
    .innerJoin(
      scheduledVersion,
      eq(scheduledVersion.id, contentItems.scheduledVersionId),
    )
    .leftJoin(
      scheduledPrimary,
      and(
        eq(scheduledPrimary.contentVersionId, scheduledVersion.id),
        eq(scheduledPrimary.isPrimary, true),
      ),
    )
    .leftJoin(
      scheduledPrimaryCategory,
      eq(scheduledPrimaryCategory.id, scheduledPrimary.categoryId),
    )
    .where(and(...conditions))
    .orderBy(asc(contentItems.scheduledAt), asc(contentItems.id));

  const versionIds = rows.map((row) => row.versionId);
  const authorsByVersion = await loadVersionAuthorSummaries(versionIds);
  const categoriesByVersion = await loadVersionCategorySummaries(versionIds);
  const todayKey = formatEditorialDateKey(now);
  const weekKeys = editorialWeekKeys(now);

  const items: EditorCalendarItem[] = rows.map((row) => {
    const categoriesForVersion = categoriesByVersion.get(row.versionId) ?? [];
    return {
      contentItemId: row.contentItemId,
      slug: row.slug,
      contentKind: row.contentKind,
      publicationStatus: row.publicationStatus,
      workflowStatus: row.workflowStatus,
      scheduledVersionId: row.scheduledVersionId!,
      scheduledAt: row.scheduledAt!,
      scheduleGeneration: row.scheduleGeneration,
      title: row.title,
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
      secondaryCategories: categoriesForVersion
        .filter((category) => !category.isPrimary)
        .map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
        })),
      authors: authorsByVersion.get(row.versionId) ?? [],
    };
  });

  return {
    items,
    summary: {
      scheduled: items.length,
      today: items.filter((item) => formatEditorialDateKey(item.scheduledAt) === todayKey)
        .length,
      thisWeek: items.filter((item) =>
        weekKeys.has(formatEditorialDateKey(item.scheduledAt)),
      ).length,
    },
  };
}

function addUtcDays(input: Date, days: number): Date {
  return new Date(input.getTime() + days * 24 * 60 * 60 * 1000);
}

function editorialWeekKeys(now: Date): Set<string> {
  const keys = new Set<string>();
  for (let offset = 0; offset < 7; offset += 1) {
    keys.add(formatEditorialDateKey(addUtcDays(now, offset)));
  }
  return keys;
}

function formatEditorialDateKey(input: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(input);
}

function emptyResult(): EditorCalendarResult {
  return {
    items: [],
    summary: {
      scheduled: 0,
      today: 0,
      thisWeek: 0,
    },
  };
}
