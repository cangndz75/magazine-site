import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  ENTITY_RELATED_STORIES_DEFAULT_LIMIT,
  ENTITY_RELATED_STORIES_MAX_LIMIT,
  PUBLIC_ENTITY_LOOKUP,
  PUBLICATION_STATUS,
  canonicalizeEntitySlug,
  relatedStoryLegalMarker,
  resolvePublicEntitySlugLookup,
  toPublicEntityPortrait,
  toPublicEntityProjection,
  type EntityRole,
  type PublicEntityProjection,
  type PublicEntitySlugResolution,
} from "@magazine/domain";
import { getDb } from "../client";
import { resolvePublicMediaUrl } from "../public/resolve-public-media-url";
import { loadPublicLegalNotices } from "../public/load-public-legal";
import {
  contentItems,
  contentVersionEntities,
  contentVersions,
} from "../schema/content";
import { entities, entityAliases, entitySlugHistory } from "../schema/entities";
import { media } from "../schema/media";

export type PublicEntityLookupResult =
  | { kind: typeof PUBLIC_ENTITY_LOOKUP.FOUND; entity: PublicEntityProjection }
  | { kind: typeof PUBLIC_ENTITY_LOOKUP.REDIRECT; slug: string; entityId: string }
  | { kind: typeof PUBLIC_ENTITY_LOOKUP.NOT_FOUND };

export type PublicEntityRelatedStoryRead = {
  contentItemId: string;
  slug: string;
  title: string;
  publishedVersionId: string;
  publishedAt: Date;
  role: EntityRole;
  legalNoticeKind: ReturnType<typeof relatedStoryLegalMarker>;
};

function toEntityRole(value: string): EntityRole {
  return value as EntityRole;
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
        storageKey: media.storageKey,
        width: media.width,
        height: media.height,
        creditLine: media.creditLine,
      })
      .from(media)
      .where(eq(media.id, row.portraitMediaId))
      .limit(1);
    if (portraitRow) {
      portrait = toPublicEntityPortrait({
        url: resolvePublicMediaUrl(input.mediaPublicBaseUrl, portraitRow.storageKey),
        width: portraitRow.width,
        height: portraitRow.height,
        altText: null,
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

export async function listPublicContentForEntity(input: {
  entityId: string;
  limit?: number;
  offset?: number;
}): Promise<PublicEntityRelatedStoryRead[]> {
  const limitRaw = input.limit ?? ENTITY_RELATED_STORIES_DEFAULT_LIMIT;
  const limit = Math.min(
    Math.max(1, Math.floor(limitRaw)),
    ENTITY_RELATED_STORIES_MAX_LIMIT,
  );
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const db = getDb();

  const rows = await db
    .select({
      contentItemId: contentItems.id,
      slug: contentItems.slug,
      title: contentVersions.title,
      publishedVersionId: contentItems.publishedVersionId,
      publishedAt: contentItems.publishedAt,
      role: contentVersionEntities.role,
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
    .limit(limit)
    .offset(offset);

  const stories: PublicEntityRelatedStoryRead[] = [];
  for (const row of rows) {
    if (!row.publishedVersionId || !row.publishedAt) {
      continue;
    }
    const notices = await loadPublicLegalNotices(row.contentItemId);
    stories.push({
      contentItemId: row.contentItemId,
      slug: row.slug,
      title: row.title,
      publishedVersionId: row.publishedVersionId,
      publishedAt: row.publishedAt,
      role: toEntityRole(row.role),
      legalNoticeKind: relatedStoryLegalMarker(notices),
    });
  }
  return stories;
}
