import {
  and,
  eq,
  exists,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  clampEditorLookupLimit,
  sanitizeEditorSearch,
  type MediaType,
} from "@magazine/domain";
import { getDb } from "../client";
import { authors } from "../schema/authors";
import { entities, entityAliases } from "../schema/entities";
import { media } from "../schema/media";
import { categories, tags } from "../schema/taxonomy";

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
}): Promise<{ id: string; name: string; slug: string }[]> {
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
    })
    .from(categories)
    .where(and(...filters))
    .orderBy(categories.name)
    .limit(limit);
}

export async function lookupEditorTags(
  input: LookupQuery,
): Promise<{ id: string; name: string; slug: string }[]> {
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
): Promise<{ id: string; displayName: string; slug: string }[]> {
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

export async function lookupEditorEntities(
  input: LookupQuery,
): Promise<{ id: string; name: string; kind: string }[]> {
  const db = getDb();
  const limit = clampEditorLookupLimit(input.limit);
  const like = pattern(input.search);
  const filters: SQL[] = [eq(entities.isActive, true)];

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
}): Promise<
  {
    id: string;
    mediaType: string;
    storageKey: string;
    width: number | null;
    height: number | null;
  }[]
> {
  const db = getDb();
  const limit = clampEditorLookupLimit(input.limit);
  const like = pattern(input.search);
  const filters: SQL[] = [];

  if (input.mediaType) {
    filters.push(eq(media.mediaType, input.mediaType));
  }

  if (like) {
    filters.push(ilike(media.storageKey, like));
  }

  const query = db
    .select({
      id: media.id,
      mediaType: media.mediaType,
      storageKey: media.storageKey,
      width: media.width,
      height: media.height,
    })
    .from(media);

  if (filters.length > 0) {
    return query.where(and(...filters)).orderBy(media.createdAt).limit(limit);
  }

  return query.orderBy(media.createdAt).limit(limit);
}
