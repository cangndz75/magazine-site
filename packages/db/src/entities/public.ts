import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  CREDIBILITY,
  CREDIBILITY_VALUES,
  ENTITY_RELATED_STORIES_DEFAULT_LIMIT,
  ENTITY_RELATED_STORIES_MAX_LIMIT,
  MEDIA_ROLE,
  MEDIA_RENDITION_SURFACE,
  MEDIA_TYPE,
  PUBLIC_ENTITY_LOOKUP,
  PUBLICATION_STATUS,
  canonicalizeEntitySlug,
  comparePublicEntityRelatedStories,
  CONTENT_LEGAL_ACTION_TYPE,
  relatedStoryLegalMarker,
  resolvePublicEntitySlugLookup,
  toPublicEntityPortrait,
  toPublicEntityProjection,
  toPublicLegalNotice,
  type Credibility,
  type EntityRole,
  type PublicEntityProjection,
  type PublicLegalNoticeKind,
  type PublicLegalNotice,
  type PublicEntitySlugResolution,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  loadMediaRenditionsByMediaIds,
  resolvePublicImageDelivery,
} from "../media/image-delivery";
import { resolvePublicMediaUrl } from "../public/resolve-public-media-url";
import {
  contentItems,
  contentLegalActions,
  contentVersionCategories,
  contentVersionEntities,
  contentVersionMedia,
  contentVersions,
} from "../schema/content";
import { entities, entityAliases, entitySlugHistory } from "../schema/entities";
import { categories } from "../schema/taxonomy";
import { media } from "../schema/media";

export type PublicEntityLookupResult =
  | { kind: typeof PUBLIC_ENTITY_LOOKUP.FOUND; entity: PublicEntityProjection }
  | { kind: typeof PUBLIC_ENTITY_LOOKUP.REDIRECT; slug: string; entityId: string }
  | { kind: typeof PUBLIC_ENTITY_LOOKUP.NOT_FOUND };

export type PublicEntityRelatedStoryCard = {
  contentItemId: string;
  slug: string;
  title: string;
  publishedVersionId: string;
  publishedAt: Date;
  role: EntityRole;
  credibility: Credibility | null;
  legalNoticeKind: PublicLegalNoticeKind | null;
  primaryCategory: { name: string; slug: string } | null;
  hero: {
    url: string;
    width: number | null;
    height: number | null;
    altText: string | null;
  } | null;
};

export type PublicEntityPage =
  | {
      status: "found";
      entity: PublicEntityProjection;
      stories: PublicEntityRelatedStoryCard[];
      totalStories: number;
      page: number;
      pageSize: number;
    }
  | { status: "redirect"; slug: string; entityId: string };

export type PublicEntityReadOptions = {
  mediaPublicBaseUrl?: string;
  limit?: number;
  offset?: number;
};

function toEntityRole(value: string): EntityRole {
  return value as EntityRole;
}

function toCredibility(value: string | null): Credibility | null {
  if (!value) {
    return null;
  }
  return (CREDIBILITY_VALUES as readonly string[]).includes(value)
    ? (value as Credibility)
    : null;
}

async function loadEntityById(entityId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1);
  return row ?? null;
}

export async function getPublicEntityBySlug(input: {
  slug: string;
  mediaPublicBaseUrl?: string;
}): Promise<PublicEntityLookupResult> {
  const slug = canonicalizeEntitySlug(input.slug);
  if (!slug.ok) {
    return { kind: PUBLIC_ENTITY_LOOKUP.NOT_FOUND };
  }

  const db = getDb();
  const [current] = await db
    .select()
    .from(entities)
    .where(eq(entities.slug, slug.value))
    .limit(1);

  let historicalOwner = null;
  if (!current) {
    const [history] = await db
      .select({ entityId: entitySlugHistory.entityId })
      .from(entitySlugHistory)
      .where(eq(entitySlugHistory.oldSlug, slug.value))
      .limit(1);
    if (history) {
      historicalOwner = await loadEntityById(history.entityId);
    }
  }

  const resolution: PublicEntitySlugResolution = resolvePublicEntitySlugLookup({
    requestedSlug: slug.value,
    current: current
      ? {
          entityId: current.id,
          slug: current.slug,
          status: current.status,
          deletedAt: current.deletedAt,
          mergedIntoEntityId: current.mergedIntoEntityId,
        }
      : null,
    historicalOwner: historicalOwner
      ? {
          entityId: historicalOwner.id,
          slug: historicalOwner.slug,
          status: historicalOwner.status,
          deletedAt: historicalOwner.deletedAt,
          mergedIntoEntityId: historicalOwner.mergedIntoEntityId,
        }
      : null,
  });

  if (resolution.kind === PUBLIC_ENTITY_LOOKUP.NOT_FOUND) {
    return { kind: PUBLIC_ENTITY_LOOKUP.NOT_FOUND };
  }
  if (resolution.kind === PUBLIC_ENTITY_LOOKUP.REDIRECT) {
    return {
      kind: PUBLIC_ENTITY_LOOKUP.REDIRECT,
      slug: resolution.slug,
      entityId: resolution.entityId,
    };
  }

  const row = current ?? historicalOwner;
  if (!row) {
    return { kind: PUBLIC_ENTITY_LOOKUP.NOT_FOUND };
  }

  const aliases = await db
    .select({ display: entityAliases.alias })
    .from(entityAliases)
    .where(eq(entityAliases.entityId, row.id));

  let portrait = null;
  if (row.portraitMediaId) {
    const [portraitRow] = await db
      .select({
        id: media.id,
        storageKey: media.storageKey,
        width: media.width,
        height: media.height,
        creditLine: media.creditLine,
      })
      .from(media)
      .where(eq(media.id, row.portraitMediaId))
      .limit(1);
    if (portraitRow && portraitRow.storageKey) {
      const renditions = await loadMediaRenditionsByMediaIds([portraitRow.id]);
      const delivery = resolvePublicImageDelivery({
        mediaPublicBaseUrl: input.mediaPublicBaseUrl,
        originalStorageKey: portraitRow.storageKey,
        originalWidth: portraitRow.width,
        originalHeight: portraitRow.height,
        renditions: renditions.get(portraitRow.id) ?? [],
        surface: MEDIA_RENDITION_SURFACE.ARTICLE_HERO,
      });
      portrait = toPublicEntityPortrait({
        url: delivery.url,
        width: delivery.width,
        height: delivery.height,
        altText: row.canonicalName,
        credit: portraitRow.creditLine,
      });
    }
  }

  return {
    kind: PUBLIC_ENTITY_LOOKUP.FOUND,
    entity: toPublicEntityProjection({
      entityId: row.id,
      kind: row.kind,
      canonicalName: row.canonicalName,
      slug: row.slug,
      summary: row.description,
      biography: row.biography,
      occupation: row.occupation,
      birthDate: row.birthDate,
      officialWebsiteUrl: row.officialWebsiteUrl,
      aliases,
      portrait,
    }),
  };
}

async function countPublicStoriesForEntity(entityId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contentItems)
    .innerJoin(
      contentVersionEntities,
      and(
        eq(contentVersionEntities.contentVersionId, contentItems.publishedVersionId),
        eq(contentVersionEntities.entityId, entityId),
      ),
    )
    .where(
      and(
        eq(contentItems.publicationStatus, PUBLICATION_STATUS.PUBLISHED),
        isNull(contentItems.deletedAt),
        isNull(contentItems.retractedAt),
        isNull(contentItems.takedownAt),
        sql`${contentItems.publishedVersionId} IS NOT NULL`,
        sql`${contentItems.publishedAt} IS NOT NULL`,
      ),
    );
  return row?.count ?? 0;
}

async function loadRelatedStoryCards(input: {
  entityId: string;
  limit: number;
  offset: number;
  mediaPublicBaseUrl?: string;
}): Promise<PublicEntityRelatedStoryCard[]> {
  const db = getDb();
  const rows = await db
    .select({
      contentItemId: contentItems.id,
      slug: contentItems.slug,
      title: contentVersions.title,
      publishedVersionId: contentItems.publishedVersionId,
      publishedAt: contentItems.publishedAt,
      role: contentVersionEntities.role,
      credibility: contentVersions.credibility,
    })
    .from(contentItems)
    .innerJoin(
      contentVersions,
      eq(contentItems.publishedVersionId, contentVersions.id),
    )
    .innerJoin(
      contentVersionEntities,
      and(
        eq(contentVersionEntities.contentVersionId, contentItems.publishedVersionId),
        eq(contentVersionEntities.entityId, input.entityId),
      ),
    )
    .where(
      and(
        eq(contentItems.publicationStatus, PUBLICATION_STATUS.PUBLISHED),
        isNull(contentItems.deletedAt),
        isNull(contentItems.retractedAt),
        isNull(contentItems.takedownAt),
        sql`${contentItems.publishedVersionId} IS NOT NULL`,
        sql`${contentItems.publishedAt} IS NOT NULL`,
      ),
    )
    .orderBy(desc(contentItems.publishedAt), contentItems.id)
    .limit(input.limit)
    .offset(input.offset);

  if (rows.length === 0) {
    return [];
  }

  const contentItemIds = rows.map((row) => row.contentItemId);
  const versionIds = rows
    .map((row) => row.publishedVersionId)
    .filter((value): value is string => value !== null);

  const [legalRows, categoryRows, heroRows] = await Promise.all([
    db
      .select({
        contentItemId: contentLegalActions.contentItemId,
        actionType: contentLegalActions.actionType,
        publicNote: contentLegalActions.publicNote,
        effectiveAt: contentLegalActions.effectiveAt,
      })
      .from(contentLegalActions)
      .where(
        and(
          inArray(contentLegalActions.contentItemId, contentItemIds),
          inArray(contentLegalActions.actionType, [
            CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
            CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION,
          ]),
        ),
      )
      .orderBy(asc(contentLegalActions.effectiveAt)),
    db
      .select({
        contentVersionId: contentVersionCategories.contentVersionId,
        name: categories.name,
        slug: categories.slug,
      })
      .from(contentVersionCategories)
      .innerJoin(categories, eq(categories.id, contentVersionCategories.categoryId))
      .where(
        and(
          inArray(contentVersionCategories.contentVersionId, versionIds),
          eq(contentVersionCategories.isPrimary, true),
        ),
      ),
    db
      .select({
        contentVersionId: contentVersionMedia.contentVersionId,
        mediaId: media.id,
        storageKey: media.storageKey,
        width: media.width,
        height: media.height,
        altText: contentVersionMedia.altText,
      })
      .from(contentVersionMedia)
      .innerJoin(media, eq(media.id, contentVersionMedia.mediaId))
      .where(
        and(
          inArray(contentVersionMedia.contentVersionId, versionIds),
          eq(contentVersionMedia.role, MEDIA_ROLE.HERO),
          eq(media.mediaType, MEDIA_TYPE.IMAGE),
        ),
      ),
  ]);

  const legalByItem = new Map<string, PublicLegalNotice[]>();
  for (const row of legalRows) {
    const notice = toPublicLegalNotice({
      actionType: row.actionType,
      publicNote: row.publicNote,
      effectiveAt: row.effectiveAt,
    });
    if (!notice) {
      continue;
    }
    const list = legalByItem.get(row.contentItemId) ?? [];
    list.push(notice);
    legalByItem.set(row.contentItemId, list);
  }

  const categoryByVersion = new Map(
    categoryRows.map((row) => [
      row.contentVersionId,
      { name: row.name, slug: row.slug },
    ]),
  );

  const heroMediaIds = heroRows.map((row) => row.mediaId);
  const renditions =
    heroMediaIds.length > 0
      ? await loadMediaRenditionsByMediaIds(heroMediaIds)
      : new Map();

  const heroByVersion = new Map<
    string,
    PublicEntityRelatedStoryCard["hero"]
  >();
  for (const row of heroRows) {
    if (!row.storageKey) {
      continue;
    }
    const delivery = resolvePublicImageDelivery({
      mediaPublicBaseUrl: input.mediaPublicBaseUrl,
      originalStorageKey: row.storageKey,
      originalWidth: row.width,
      originalHeight: row.height,
      renditions: renditions.get(row.mediaId) ?? [],
      surface: MEDIA_RENDITION_SURFACE.HOMEPAGE_THUMB,
    });
    if (!delivery.url) {
      continue;
    }
    heroByVersion.set(row.contentVersionId, {
      url: delivery.url,
      width: delivery.width,
      height: delivery.height,
      altText: row.altText,
    });
  }

  const stories: PublicEntityRelatedStoryCard[] = [];
  for (const row of rows) {
    if (!row.publishedVersionId || !row.publishedAt) {
      continue;
    }
    const legalKinds = legalByItem.get(row.contentItemId) ?? [];
    stories.push({
      contentItemId: row.contentItemId,
      slug: row.slug,
      title: row.title,
      publishedVersionId: row.publishedVersionId,
      publishedAt: row.publishedAt,
      role: toEntityRole(row.role),
      credibility: toCredibility(row.credibility),
      legalNoticeKind: relatedStoryLegalMarker(legalByItem.get(row.contentItemId) ?? []),
      primaryCategory: categoryByVersion.get(row.publishedVersionId) ?? null,
      hero: heroByVersion.get(row.publishedVersionId) ?? null,
    });
  }

  return stories.sort((left, right) =>
    comparePublicEntityRelatedStories(
      {
        contentItemId: left.contentItemId,
        publishedVersionId: left.publishedVersionId,
        publishedAt: left.publishedAt,
        role: left.role,
        credibility: left.credibility,
        legalNoticeKind: left.legalNoticeKind,
      },
      {
        contentItemId: right.contentItemId,
        publishedVersionId: right.publishedVersionId,
        publishedAt: right.publishedAt,
        role: right.role,
        credibility: right.credibility,
        legalNoticeKind: right.legalNoticeKind,
      },
    ),
  );
}

export async function getPublicEntityPageBySlug(
  rawSlug: string,
  options: PublicEntityReadOptions = {},
): Promise<PublicEntityPage | null> {
  const lookup = await getPublicEntityBySlug({
    slug: rawSlug,
    mediaPublicBaseUrl: options.mediaPublicBaseUrl,
  });

  if (lookup.kind === PUBLIC_ENTITY_LOOKUP.NOT_FOUND) {
    return null;
  }
  if (lookup.kind === PUBLIC_ENTITY_LOOKUP.REDIRECT) {
    return {
      status: "redirect",
      slug: lookup.slug,
      entityId: lookup.entityId,
    };
  }

  const limitRaw = options.limit ?? ENTITY_RELATED_STORIES_DEFAULT_LIMIT;
  const limit = Math.min(
    Math.max(1, Math.floor(limitRaw)),
    ENTITY_RELATED_STORIES_MAX_LIMIT,
  );
  const offset = Math.max(0, Math.floor(options.offset ?? 0));

  const [stories, totalStories] = await Promise.all([
    loadRelatedStoryCards({
      entityId: lookup.entity.entityId,
      limit,
      offset,
      mediaPublicBaseUrl: options.mediaPublicBaseUrl,
    }),
    countPublicStoriesForEntity(lookup.entity.entityId),
  ]);

  return {
    status: "found",
    entity: lookup.entity,
    stories,
    totalStories,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
  };
}

/** @deprecated Use getPublicEntityPageBySlug for enriched cards. */
export type PublicEntityRelatedStoryRead = PublicEntityRelatedStoryCard;

export async function listPublicContentForEntity(input: {
  entityId: string;
  limit?: number;
  offset?: number;
  mediaPublicBaseUrl?: string;
}): Promise<PublicEntityRelatedStoryCard[]> {
  const limitRaw = input.limit ?? ENTITY_RELATED_STORIES_DEFAULT_LIMIT;
  const limit = Math.min(
    Math.max(1, Math.floor(limitRaw)),
    ENTITY_RELATED_STORIES_MAX_LIMIT,
  );
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  return loadRelatedStoryCards({
    entityId: input.entityId,
    limit,
    offset,
    mediaPublicBaseUrl: input.mediaPublicBaseUrl,
  });
}
