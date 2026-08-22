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
  clampSearchLimit,
  normalizeSearchQuery,
  type EditorSearchResultsDto,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentVersionCategories,
  contentVersionEntities,
  contentVersions,
} from "../schema/content";
import { entities, entityAliases } from "../schema/entities";
import type { EditorStaffQueryScope } from "../editor/types";

const displayVersion = alias(contentVersions, "editor_search_version");
const matchedEntity = alias(entities, "editor_search_entity");

export async function searchEditorContent(input: {
  scope: EditorStaffQueryScope;
  query: string;
  limit?: number;
}): Promise<EditorSearchResultsDto> {
  const parsed = normalizeSearchQuery(input.query);
  if (!parsed.ok) {
    return { query: input.query, normalizedQuery: "", items: [] };
  }

  if (
    input.scope.scopedCategoryIds !== null &&
    input.scope.scopedCategoryIds.length === 0
  ) {
    return {
      query: input.query,
      normalizedQuery: parsed.normalizedQuery,
      items: [],
    };
  }

  const db = getDb();
  const limit = clampSearchLimit(input.limit);
  const pattern = `%${parsed.normalizedQuery}%`;
  const conditions: SQL[] = [isNull(contentItems.deletedAt)];

  if (input.scope.scopedCategoryIds !== null) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(contentVersionCategories)
          .where(
            and(
              eq(contentVersionCategories.contentVersionId, displayVersion.id),
              inArray(contentVersionCategories.categoryId, [
                ...input.scope.scopedCategoryIds,
              ]),
            ),
          ),
      ),
    );
  }

  const searchClause = or(
    ilike(displayVersion.title, pattern),
    ilike(contentItems.slug, pattern),
    exists(
      db
        .select({ one: sql`1` })
        .from(contentVersionEntities)
        .innerJoin(matchedEntity, eq(matchedEntity.id, contentVersionEntities.entityId))
        .where(
          and(
            eq(contentVersionEntities.contentVersionId, displayVersion.id),
            isNull(matchedEntity.deletedAt),
            isNull(matchedEntity.mergedIntoEntityId),
            or(
              ilike(matchedEntity.canonicalName, pattern),
              exists(
                db
                  .select({ one: sql`1` })
                  .from(entityAliases)
                  .where(
                    and(
                      eq(entityAliases.entityId, matchedEntity.id),
                      or(
                        ilike(entityAliases.alias, pattern),
                        ilike(entityAliases.normalizedAlias, pattern),
                      ),
                    ),
                  ),
              ),
            ),
          ),
        ),
    ),
  );
  if (searchClause) {
    conditions.push(searchClause);
  }

  const rows = await db
    .select({
      id: contentItems.id,
      slug: contentItems.slug,
      contentKind: contentItems.contentKind,
      publicationStatus: contentItems.publicationStatus,
      workflowStatus: displayVersion.workflowStatus,
      title: displayVersion.title,
    })
    .from(contentItems)
    .innerJoin(
      displayVersion,
      eq(
        displayVersion.id,
        sql`coalesce(${contentItems.publishedVersionId}, ${contentItems.draftVersionId})`,
      ),
    )
    .where(and(...conditions))
    .orderBy(displayVersion.title)
    .limit(limit);

  return {
    query: input.query,
    normalizedQuery: parsed.normalizedQuery,
    items: rows.map((row) => ({
      contentItemId: row.id,
      contentKind: row.contentKind,
      title: row.title,
      slug: row.slug,
      publicationStatus: row.publicationStatus,
      workflowStatus: row.workflowStatus,
      editorHref: `/content/${row.id}`,
    })),
  };
}
