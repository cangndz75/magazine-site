import { eq, inArray } from "drizzle-orm";
import { getDb } from "../client";
import { authors } from "../schema/authors";
import {
  contentVersionAuthors,
  contentVersionCategories,
} from "../schema/content";
import { categories } from "../schema/taxonomy";
import type {
  EditorListAuthorSummary,
  EditorListPrimaryCategory,
} from "./types";

export async function loadVersionAuthorSummaries(
  versionIds: string[],
): Promise<Map<string, EditorListAuthorSummary[]>> {
  const grouped = new Map<string, EditorListAuthorSummary[]>();
  if (versionIds.length === 0) {
    return grouped;
  }

  const db = getDb();
  const rows = await db
    .select({
      contentVersionId: contentVersionAuthors.contentVersionId,
      id: authors.id,
      displayName: authors.displayName,
      slug: authors.slug,
      sortOrder: contentVersionAuthors.sortOrder,
    })
    .from(contentVersionAuthors)
    .innerJoin(authors, eq(authors.id, contentVersionAuthors.authorId))
    .where(inArray(contentVersionAuthors.contentVersionId, versionIds))
    .orderBy(contentVersionAuthors.sortOrder);

  for (const row of rows) {
    const list = grouped.get(row.contentVersionId) ?? [];
    list.push({
      id: row.id,
      displayName: row.displayName,
      slug: row.slug,
    });
    grouped.set(row.contentVersionId, list);
  }

  return grouped;
}

export type VersionCategorySummary = EditorListPrimaryCategory & {
  isPrimary: boolean;
};

export async function loadVersionCategorySummaries(
  versionIds: string[],
): Promise<Map<string, VersionCategorySummary[]>> {
  const grouped = new Map<string, VersionCategorySummary[]>();
  if (versionIds.length === 0) {
    return grouped;
  }

  const db = getDb();
  const rows = await db
    .select({
      contentVersionId: contentVersionCategories.contentVersionId,
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      isPrimary: contentVersionCategories.isPrimary,
    })
    .from(contentVersionCategories)
    .innerJoin(categories, eq(categories.id, contentVersionCategories.categoryId))
    .where(inArray(contentVersionCategories.contentVersionId, versionIds));

  for (const row of rows) {
    const list = grouped.get(row.contentVersionId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      isPrimary: row.isPrimary,
    });
    grouped.set(row.contentVersionId, list);
  }

  return grouped;
}
