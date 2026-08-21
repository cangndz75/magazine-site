import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  ENTITY_LINK_ASSISTANT_BOUNDS,
  ENTITY_LINK_MATCHED_BY,
  ENTITY_STATUS,
  clampEntityLinkCatalogue,
  collectStaleEntitySlugWarnings,
  inspectArticleTextForEntityLinks,
  isPublicEntityProfileEligible,
  matchEntityLinkSuggestions,
  normalizeEntitySearchKey,
  parsePublicEntityProfileSlug,
  type EntityKind,
  type EntityLinkCatalogueEntry,
  type EntityLinkSuggestion,
  type EntityStaleSlugWarning,
  type EntityStatus,
} from "@magazine/domain";
import { getDb } from "../client";
import { entities, entityAliases, entitySlugHistory } from "../schema/entities";

export type EntityLinkSuggestionResult = {
  suggestions: EntityLinkSuggestion[];
  staleSlugWarnings: EntityStaleSlugWarning[];
  truncated: boolean;
};

export async function loadEntityLinkCatalogue(): Promise<{
  items: EntityLinkCatalogueEntry[];
  truncated: boolean;
}> {
  const db = getDb();
  const rows = await db
    .select({
      entityId: entities.id,
      canonicalName: entities.canonicalName,
      slug: entities.slug,
      kind: entities.kind,
      status: entities.status,
    })
    .from(entities)
    .where(
      and(
        eq(entities.status, ENTITY_STATUS.ACTIVE),
        isNull(entities.deletedAt),
        isNull(entities.mergedIntoEntityId),
      ),
    )
    .orderBy(entities.id)
    .limit(ENTITY_LINK_ASSISTANT_BOUNDS.MAX_CATALOGUE + 1);

  const clamped = clampEntityLinkCatalogue(rows);
  if (clamped.items.length === 0) {
    return { items: [], truncated: clamped.truncated };
  }

  const ids = clamped.items.map((row) => row.entityId);
  const aliasRows = await db
    .select({
      entityId: entityAliases.entityId,
      display: entityAliases.alias,
      searchKey: entityAliases.normalizedAlias,
    })
    .from(entityAliases)
    .where(inArray(entityAliases.entityId, ids));

  const aliasesByEntity = new Map<string, { display: string; searchKey: string }[]>();
  for (const row of aliasRows) {
    const list = aliasesByEntity.get(row.entityId) ?? [];
    list.push({ display: row.display, searchKey: row.searchKey });
    aliasesByEntity.set(row.entityId, list);
  }

  return {
    truncated: clamped.truncated,
    items: clamped.items.map((row) => ({
      entityId: row.entityId,
      canonicalName: row.canonicalName,
      slug: row.slug,
      kind: row.kind as EntityKind,
      status: row.status as EntityStatus,
      labels: [
        {
          display: row.canonicalName,
          searchKey: normalizeEntitySearchKey(row.canonicalName),
          matchedBy: ENTITY_LINK_MATCHED_BY.CANONICAL_NAME,
        },
        ...(aliasesByEntity.get(row.entityId) ?? []).map((alias) => ({
          display: alias.display,
          searchKey: alias.searchKey,
          matchedBy: ENTITY_LINK_MATCHED_BY.ALIAS,
        })),
      ],
    })),
  };
}

export async function lookupHistoricalEntitySlugs(slugs: readonly string[]): Promise<
  Map<
    string,
    {
      entityId: string;
      currentSlug: string;
      canonicalName: string;
      publicEligible: boolean;
    }
  >
> {
  const unique = [...new Set(slugs)].filter((slug) => slug.length > 0);
  const result = new Map<
    string,
    {
      entityId: string;
      currentSlug: string;
      canonicalName: string;
      publicEligible: boolean;
    }
  >();
  if (unique.length === 0) {
    return result;
  }

  const db = getDb();
  const rows = await db
    .select({
      oldSlug: entitySlugHistory.oldSlug,
      entityId: entities.id,
      currentSlug: entities.slug,
      canonicalName: entities.canonicalName,
      status: entities.status,
      deletedAt: entities.deletedAt,
      mergedIntoEntityId: entities.mergedIntoEntityId,
    })
    .from(entitySlugHistory)
    .innerJoin(entities, eq(entities.id, entitySlugHistory.entityId))
    .where(inArray(entitySlugHistory.oldSlug, unique));

  for (const row of rows) {
    result.set(row.oldSlug, {
      entityId: row.entityId,
      currentSlug: row.currentSlug,
      canonicalName: row.canonicalName,
      publicEligible: isPublicEntityProfileEligible({
        status: row.status,
        slug: row.currentSlug,
        deletedAt: row.deletedAt,
        mergedIntoEntityId: row.mergedIntoEntityId,
      }),
    });
  }
  return result;
}

export async function suggestEntityLinksForArticle(input: {
  body: unknown;
  title?: string | null;
  relatedEntityIds?: readonly string[];
}): Promise<EntityLinkSuggestionResult> {
  const inspection = inspectArticleTextForEntityLinks({
    body: input.body,
    title: input.title,
  });
  const catalogue = await loadEntityLinkCatalogue();
  const suggestions = matchEntityLinkSuggestions({
    text: inspection.text,
    hrefs: inspection.hrefs,
    catalogue: catalogue.items,
    relatedEntityIds: input.relatedEntityIds,
  });

  const requested = inspection.hrefs
    .map((href) => parsePublicEntityProfileSlug(href))
    .filter((slug): slug is string => slug !== null);
  const historical = await lookupHistoricalEntitySlugs(requested);
  const staleSlugWarnings = collectStaleEntitySlugWarnings({
    hrefs: inspection.hrefs,
    currentByOldSlug: historical,
  });

  return {
    suggestions,
    staleSlugWarnings,
    truncated: inspection.truncated || catalogue.truncated,
  };
}
