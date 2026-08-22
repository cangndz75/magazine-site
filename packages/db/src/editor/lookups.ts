import {
  and,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  ENTITY_STATUS,
  clampEditorLookupLimit,
  sanitizeEditorSearch,
  type MediaType,
} from "@magazine/domain";
import { getDb } from "../client";
import { authors } from "../schema/authors";
import { entities, entityAliases } from "../schema/entities";
import { media } from "../schema/media";
import { categories, tags } from "../schema/taxonomy";
import { formatEditorMediaLabel } from "./media-label";
import { eligibilityForRow } from "./media-projections";

const parentCategory = alias(categories, "editor_parent_category");

export type EditorCategoryLookup = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
};

export type EditorAuthorLookup = {
  id: string;
  displayName: string;
  slug: string;
};

export type EditorTagLookup = {
  id: string;
  name: string;
  slug: string;
};

export type EditorEntityLookup = {
  id: string;
  name: string;
  kind: string;
  status: string;
};

export type EditorMediaLookup = {
  id: string;
  label: string;
  mediaType: string;
  width: number | null;
  height: number | null;
  creditLine: string | null;
  eligibility: {
    eligible: boolean;
    status: string;
    reasons: string[];
  };
};

export type LookupQuery = {
  search?: string;
  limit?: number;
};

function pattern(search: string | undefined): string | null {
  const sanitized = sanitizeEditorSearch(search);
  return sanitized ? `%${sanitized}%` : null;
}

export async function lookupEditorCategories(input: {
  search?: string;
  limit?: number;
  scopedCategoryIds: readonly string[] | null;
}): Promise<EditorCategoryLookup[]> {
  if (
    input.scopedCategoryIds !== null &&
    input.scopedCategoryIds.length === 0
  ) {
    return [];
  }

  const db = getDb();
  const limit = clampEditorLookupLimit(input.limit);
  const like = pattern(input.search);
  const filters: SQL[] = [eq(categories.isActive, true)];

  if (input.scopedCategoryIds !== null) {
    filters.push(inArray(categories.id, [...input.scopedCategoryIds]));
  }

  if (like) {
    const searchClause = or(
      ilike(categories.name, like),
      ilike(categories.slug, like),
      ilike(parentCategory.name, like),
    );
    if (searchClause) {
      filters.push(searchClause);
    }
  }

  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      parentId: categories.parentId,
      parentName: parentCategory.name,
    })
    .from(categories)
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .where(and(...filters))
    .orderBy(categories.name)
    .limit(limit);
}

export async function getEditorCategorySummary(
  categoryId: string,
  scopedCategoryIds: readonly string[] | null,
): Promise<EditorCategoryLookup | null> {
  if (
    scopedCategoryIds !== null &&
    (scopedCategoryIds.length === 0 || !scopedCategoryIds.includes(categoryId))
  ) {
    return null;
  }

  const db = getDb();
  const [row] = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      parentId: categories.parentId,
      parentName: parentCategory.name,
    })
    .from(categories)
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .where(and(eq(categories.id, categoryId), eq(categories.isActive, true)))
    .limit(1);

  return row ?? null;
}

export async function lookupEditorTags(
  input: LookupQuery,
): Promise<EditorTagLookup[]> {
  const db = getDb();
  const limit = clampEditorLookupLimit(input.limit);
  const like = pattern(input.search);
  const query = db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(tags);

  if (like) {
    const searchClause = or(ilike(tags.name, like), ilike(tags.slug, like));
    if (searchClause) {
      return query.where(searchClause).orderBy(tags.name).limit(limit);
    }
  }

  return query.orderBy(tags.name).limit(limit);
}

export async function lookupEditorAuthors(
  input: LookupQuery,
): Promise<EditorAuthorLookup[]> {
  const db = getDb();
  const limit = clampEditorLookupLimit(input.limit);
  const like = pattern(input.search);
  const filters: SQL[] = [eq(authors.isActive, true)];
  if (like) {
    const searchClause = or(
      ilike(authors.displayName, like),
      ilike(authors.slug, like),
    );
    if (searchClause) {
      filters.push(searchClause);
    }
  }

  return db
    .select({
      id: authors.id,
      displayName: authors.displayName,
      slug: authors.slug,
    })
    .from(authors)
    .where(and(...filters))
    .orderBy(authors.displayName)
    .limit(limit);
}

export async function getEditorAuthorSummary(
  authorId: string,
): Promise<EditorAuthorLookup | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: authors.id,
      displayName: authors.displayName,
      slug: authors.slug,
    })
    .from(authors)
    .where(and(eq(authors.id, authorId), eq(authors.isActive, true)))
    .limit(1);

  return row ?? null;
}

export async function lookupEditorEntities(
  input: LookupQuery,
): Promise<EditorEntityLookup[]> {
  const db = getDb();
  const limit = clampEditorLookupLimit(input.limit);
  const like = pattern(input.search);
  const filters: SQL[] = [
    eq(entities.status, ENTITY_STATUS.ACTIVE),
    isNull(entities.deletedAt),
    isNull(entities.mergedIntoEntityId),
  ];

  if (like) {
    const searchClause = or(
      ilike(entities.canonicalName, like),
      ilike(entities.slug, like),
      exists(
        db
          .select({ one: sql`1` })
          .from(entityAliases)
          .where(
            and(
              eq(entityAliases.entityId, entities.id),
              or(
                ilike(entityAliases.alias, like),
                ilike(entityAliases.normalizedAlias, like),
              ),
            ),
          ),
      ),
    );
    if (searchClause) {
      filters.push(searchClause);
    }
  }

  return db
    .select({
      id: entities.id,
      name: entities.canonicalName,
      kind: entities.kind,
      status: entities.status,
    })
    .from(entities)
    .where(and(...filters))
    .orderBy(entities.canonicalName)
    .limit(limit);
}

export async function lookupEditorMedia(input: {
  search?: string;
  limit?: number;
  mediaType?: MediaType;
  now?: Date;
}): Promise<EditorMediaLookup[]> {
  const db = getDb();
  const now = input.now ?? new Date();
  const limit = clampEditorLookupLimit(input.limit);
  const like = pattern(input.search);
  const filters: SQL[] = [];

  if (input.mediaType) {
    filters.push(eq(media.mediaType, input.mediaType));
  }

  if (like) {
    filters.push(
      or(ilike(media.storageKey, like), ilike(media.originalFilename, like))!,
    );
  }

  const baseQuery = db.select().from(media);
  const rows =
    filters.length > 0
      ? await baseQuery.where(and(...filters)).orderBy(media.createdAt).limit(limit)
      : await baseQuery.orderBy(media.createdAt).limit(limit);

  return rows.map((row) => ({
    id: row.id,
    mediaType: row.mediaType,
    width: row.width,
    height: row.height,
    label: formatEditorMediaLabel(row),
    creditLine: row.creditLine,
    eligibility: eligibilityForRow(row, now),
  }));
}
