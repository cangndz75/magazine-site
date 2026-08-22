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
  CONTENT_KIND,
  ENTITY_STATUS,
  FEATURE_FLAG_KEY,
  MEDIA_RENDITION_SURFACE,
  PUBLIC_ENTITY_PROFILE_PATH_PREFIX,
  PUBLICATION_STATUS,
  assertSafeSearchResultsDto,
  clampSearchLimit,
  decodeSearchCursor,
  encodeSearchCursor,
  normalizeSearchQuery,
  SEARCH_FILTER,
  SEARCH_RESULT_KIND,
  type SearchProvider,
  type SearchProviderContext,
  type SearchProviderInput,
  type SearchResultItem,
  type SearchResultsDto,
  type ContentKind,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentVersionCategories,
  contentVersionEntities,
  contentVersions,
} from "../schema/content";
import { entities, entityAliases } from "../schema/entities";
import { categories } from "../schema/taxonomy";
import { media } from "../schema/media";
import {
  loadMediaRenditionsByMediaIds,
  resolvePublicImageDelivery,
} from "../media/image-delivery";
import { isFeatureEnabled } from "../feature-controls";
import { loadPublishedHeroMedia } from "../public/published-hero";

const ENTITY_RESULT_CAP_ALL = 5;
const ENTITY_RESULT_CAP = 25;

function iso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function ilikePattern(normalizedQuery: string): string {
  return `%${normalizedQuery}%`;
}

function publicContentHref(contentKind: string, slug: string): string {
  if (contentKind === CONTENT_KIND.GALLERY) {
    return `/galeri/${slug}`;
  }
  return `/${slug}`;
}

export class PostgresSearchProvider implements SearchProvider {
  async searchPublic(
    input: SearchProviderInput,
    context: SearchProviderContext,
  ): Promise<SearchResultsDto> {
    if (!(await isFeatureEnabled(FEATURE_FLAG_KEY.PUBLIC_SEARCH))) {
      return {
        query: input.query,
        normalizedQuery: "",
        filter: input.filter ?? SEARCH_FILTER.ALL,
        items: [],
        nextCursor: null,
      };
    }

    const parsed = normalizeSearchQuery(input.query);
    if (!parsed.ok) {
      return {
        query: input.query,
        normalizedQuery: "",
        filter: input.filter ?? SEARCH_FILTER.ALL,
        items: [],
        nextCursor: null,
      };
    }

    const filter = input.filter ?? SEARCH_FILTER.ALL;
    const limit = clampSearchLimit(input.limit);
    const pattern = ilikePattern(parsed.normalizedQuery);
    const items: SearchResultItem[] = [];

    if (filter === SEARCH_FILTER.ALL || filter === SEARCH_FILTER.ENTITY) {
      const entityLimit =
        filter === SEARCH_FILTER.ALL ? ENTITY_RESULT_CAP_ALL : ENTITY_RESULT_CAP;
      const entityItems = await searchPublicEntities({
        pattern,
        limit: entityLimit,
        mediaPublicBaseUrl: context.mediaPublicBaseUrl,
      });
      items.push(...entityItems);
    }

    if (filter !== SEARCH_FILTER.ENTITY) {
      const contentKinds =
        filter === SEARCH_FILTER.ARTICLE
          ? [CONTENT_KIND.ARTICLE]
          : filter === SEARCH_FILTER.GALLERY
            ? [CONTENT_KIND.GALLERY]
            : [CONTENT_KIND.ARTICLE, CONTENT_KIND.GALLERY];

      const contentLimit =
        filter === SEARCH_FILTER.ALL
          ? Math.max(1, limit - items.length)
          : limit;

      const { items: contentItems, nextCursor } = await searchPublicContent({
        pattern,
        contentKinds,
        limit: contentLimit,
        cursor: input.cursor ?? null,
        mediaPublicBaseUrl: context.mediaPublicBaseUrl,
      });

      if (filter === SEARCH_FILTER.ALL) {
        items.push(...contentItems.slice(0, Math.max(0, limit - items.length)));
      } else {
        items.push(...contentItems);
      }

      const dto: SearchResultsDto = {
        query: input.query,
        normalizedQuery: parsed.normalizedQuery,
        filter,
        items,
        nextCursor: filter === SEARCH_FILTER.ALL ? null : nextCursor,
      };
      assertSafeSearchResultsDto(dto);
      return dto;
    }

    const dto: SearchResultsDto = {
      query: input.query,
      normalizedQuery: parsed.normalizedQuery,
      filter,
      items,
      nextCursor: null,
    };
    assertSafeSearchResultsDto(dto);
    return dto;
  }
}

async function searchPublicEntities(input: {
  pattern: string;
  limit: number;
  mediaPublicBaseUrl?: string;
}): Promise<SearchResultItem[]> {
  const db = getDb();
  const searchClause = or(
    ilike(entities.canonicalName, input.pattern),
    ilike(entities.slug, input.pattern),
    exists(
      db
        .select({ one: sql`1` })
        .from(entityAliases)
        .where(
          and(
            eq(entityAliases.entityId, entities.id),
            or(
              ilike(entityAliases.alias, input.pattern),
              ilike(entityAliases.normalizedAlias, input.pattern),
            ),
          ),
        ),
    ),
  );

  const rows = await db
    .select({
      id: entities.id,
      canonicalName: entities.canonicalName,
      slug: entities.slug,
      portraitMediaId: entities.portraitMediaId,
      updatedAt: entities.updatedAt,
    })
    .from(entities)
    .where(
      and(
        eq(entities.status, ENTITY_STATUS.ACTIVE),
        isNull(entities.deletedAt),
        isNull(entities.mergedIntoEntityId),
        searchClause,
      ),
    )
    .orderBy(asc(entities.canonicalName), asc(entities.id))
    .limit(input.limit);

  const portraitIds = rows
    .map((row) => row.portraitMediaId)
    .filter((id): id is string => Boolean(id));

  const portraitMedia =
    portraitIds.length > 0
      ? await db
          .select({
            id: media.id,
            storageKey: media.storageKey,
            width: media.width,
            height: media.height,
          })
          .from(media)
          .where(inArray(media.id, portraitIds))
      : [];

  const portraitMap = new Map(portraitMedia.map((row) => [row.id, row]));
  const renditionsMap =
    portraitIds.length > 0
      ? await loadMediaRenditionsByMediaIds(portraitIds)
      : new Map();

  return rows.map((row) => {
    let imageUrl: string | null = null;
    if (row.portraitMediaId) {
      const portrait = portraitMap.get(row.portraitMediaId);
      if (portrait) {
        const delivery = resolvePublicImageDelivery({
          mediaPublicBaseUrl: input.mediaPublicBaseUrl,
          originalStorageKey: portrait.storageKey,
          originalWidth: portrait.width,
          originalHeight: portrait.height,
          renditions: renditionsMap.get(row.portraitMediaId) ?? [],
          surface: MEDIA_RENDITION_SURFACE.LIBRARY_CARD,
        });
        imageUrl = delivery.thumbUrl ?? delivery.url;
      }
    }

    return {
      kind: SEARCH_RESULT_KIND.ENTITY,
      id: row.id,
      title: row.canonicalName,
      excerpt: null,
      href: `${PUBLIC_ENTITY_PROFILE_PATH_PREFIX}/${encodeURIComponent(row.slug)}`,
      imageUrl,
      publishedAt: iso(row.updatedAt),
      categoryLabel: "Profil",
      matchedEntityLabel: null,
    };
  });
}

async function searchPublicContent(input: {
  pattern: string;
  contentKinds: readonly ContentKind[];
  limit: number;
  cursor: string | null;
  mediaPublicBaseUrl?: string;
}): Promise<{ items: SearchResultItem[]; nextCursor: string | null }> {
  const db = getDb();
  const publishedVersion = alias(contentVersions, "search_published_version");
  const primaryCategory = alias(categories, "search_primary_category");
  const matchedEntity = alias(entities, "search_matched_entity");

  const conditions: SQL[] = [
    eq(contentItems.publicationStatus, PUBLICATION_STATUS.PUBLISHED),
    isNull(contentItems.deletedAt),
    isNull(contentItems.retractedAt),
    isNull(contentItems.takedownAt),
    isNotNull(contentItems.publishedVersionId),
    isNotNull(contentItems.publishedAt),
    inArray(contentItems.contentKind, [...input.contentKinds]),
    or(
      ilike(publishedVersion.title, input.pattern),
      ilike(publishedVersion.excerpt, input.pattern),
      ilike(contentItems.slug, input.pattern),
      exists(
        db
          .select({ one: sql`1` })
          .from(contentVersionEntities)
          .innerJoin(matchedEntity, eq(matchedEntity.id, contentVersionEntities.entityId))
          .where(
            and(
              eq(contentVersionEntities.contentVersionId, publishedVersion.id),
              eq(matchedEntity.status, ENTITY_STATUS.ACTIVE),
              isNull(matchedEntity.deletedAt),
              isNull(matchedEntity.mergedIntoEntityId),
              or(
                ilike(matchedEntity.canonicalName, input.pattern),
                exists(
                  db
                    .select({ one: sql`1` })
                    .from(entityAliases)
                    .where(
                      and(
                        eq(entityAliases.entityId, matchedEntity.id),
                        or(
                          ilike(entityAliases.alias, input.pattern),
                          ilike(entityAliases.normalizedAlias, input.pattern),
                        ),
                      ),
                    ),
                ),
              ),
            ),
          ),
      ),
    )!,
  ];

  const cursor = decodeSearchCursor(input.cursor);
  if (cursor) {
    const cursorPublishedAt = new Date(cursor.publishedAt);
    const cursorClause = or(
      lt(contentItems.publishedAt, cursorPublishedAt),
      and(
        eq(contentItems.publishedAt, cursorPublishedAt),
        lt(contentItems.id, cursor.id),
      ),
    );
    if (cursorClause) {
      conditions.push(cursorClause);
    }
  }

  const rows = await db
    .select({
      id: contentItems.id,
      slug: contentItems.slug,
      contentKind: contentItems.contentKind,
      publishedAt: contentItems.publishedAt,
      title: publishedVersion.title,
      excerpt: publishedVersion.excerpt,
      categoryName: primaryCategory.name,
      matchedEntityName: sql<string | null>`(
        select e.canonical_name
        from content_version_entities cve
        inner join entities e on e.id = cve.entity_id
        where cve.content_version_id = ${publishedVersion.id}
          and e.status = ${ENTITY_STATUS.ACTIVE}
          and e.deleted_at is null
          and e.merged_into_entity_id is null
          and (
            e.canonical_name ilike ${input.pattern}
            or exists (
              select 1 from entity_aliases ea
              where ea.entity_id = e.id
                and (ea.alias ilike ${input.pattern} or ea.normalized_alias ilike ${input.pattern})
            )
          )
        order by e.canonical_name asc
        limit 1
      )`,
    })
    .from(contentItems)
    .innerJoin(
      publishedVersion,
      eq(publishedVersion.id, contentItems.publishedVersionId),
    )
    .leftJoin(
      contentVersionCategories,
      and(
        eq(contentVersionCategories.contentVersionId, publishedVersion.id),
        eq(contentVersionCategories.isPrimary, true),
      ),
    )
    .leftJoin(primaryCategory, eq(primaryCategory.id, contentVersionCategories.categoryId))
    .where(and(...conditions))
    .orderBy(desc(contentItems.publishedAt), desc(contentItems.id))
    .limit(input.limit + 1);

  const page = rows.slice(0, input.limit);
  const hasMore = rows.length > input.limit;

  const items: SearchResultItem[] = await Promise.all(
    page.map(async (row) => {
      const hero = await loadPublishedHeroMedia({
        contentItemId: row.id,
        mediaPublicBaseUrl: input.mediaPublicBaseUrl,
      });

      const kind =
        row.contentKind === CONTENT_KIND.GALLERY
          ? SEARCH_RESULT_KIND.GALLERY
          : SEARCH_RESULT_KIND.ARTICLE;

      return {
        kind,
        id: row.id,
        title: row.title,
        excerpt: row.excerpt,
        href: publicContentHref(row.contentKind, row.slug),
        imageUrl: hero?.url ?? null,
        publishedAt: iso(row.publishedAt),
        categoryLabel: row.categoryName ?? null,
        matchedEntityLabel: row.matchedEntityName ?? null,
      };
    }),
  );

  const last = page.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeSearchCursor({
          publishedAt: iso(last.publishedAt)!,
          id: last.id,
          kind:
            last.contentKind === CONTENT_KIND.GALLERY
              ? SEARCH_RESULT_KIND.GALLERY
              : SEARCH_RESULT_KIND.ARTICLE,
        })
      : null;

  return { items, nextCursor };
}

export function createPostgresSearchProvider(): SearchProvider {
  return new PostgresSearchProvider();
}

export async function searchPublic(
  input: SearchProviderInput,
  context: SearchProviderContext = {},
): Promise<SearchResultsDto> {
  return createPostgresSearchProvider().searchPublic(input, context);
}
