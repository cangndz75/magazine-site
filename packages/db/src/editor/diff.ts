import { and, eq, inArray } from "drizzle-orm";
import {
  PUBLISHING_ERROR,
  PublishingError,
  canAccessEditorContentByPrimaryCategory,
  diffContentVersions,
  isUuid,
  type ContentVersionDiff,
  type ContentVersionDiffSideInput,
  type EditorStaffScope,
} from "@magazine/domain";
import { getDb } from "../client";
import { authors } from "../schema/authors";
import {
  contentVersionAuthors,
  contentVersionCategories,
  contentVersionEntities,
  contentVersionMedia,
  contentVersionTags,
  contentVersions,
} from "../schema/content";
import { entities } from "../schema/entities";
import { media } from "../schema/media";
import { categories, tags } from "../schema/taxonomy";
import { unwrapPublishingDecision } from "../publishing/errors";
import { getEditorContentAccess } from "./access";
import { formatEditorMediaLabel } from "./media-label";
import type { EditorContentAccess } from "./types";

type VersionRow = {
  id: string;
  contentItemId: string;
  versionNumber: number;
  workflowStatus: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  body: unknown;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  credibility: string | null;
  credibilitySource: string | null;
  source: string | null;
  sourceOrganization: string | null;
  sourceUrl: string | null;
  syndicated: boolean;
  isMaterialUpdate: boolean;
  createdAt: Date;
};

function asDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_FOUND);
  }

  return parsed;
}

function emptyRelations() {
  return {
    categories: [] as {
      contentVersionId: string;
      id: string;
      name: string;
      slug: string;
      isPrimary: boolean;
    }[],
    tags: [] as {
      contentVersionId: string;
      id: string;
      name: string;
      slug: string;
    }[],
    entities: [] as {
      contentVersionId: string;
      id: string;
      name: string;
      kind: string;
      role: string;
      sortOrder: number;
    }[],
    media: [] as {
      contentVersionId: string;
      id: string;
      label: string;
      role: string;
      sortOrder: number;
      caption: string | null;
      altText: string | null;
      credit: string | null;
    }[],
    authors: [] as {
      contentVersionId: string;
      id: string;
      displayName: string;
      slug: string;
      role: string;
      sortOrder: number;
    }[],
  };
}

async function loadLabeledRelations(versionIds: readonly string[]) {
  if (versionIds.length === 0) {
    return emptyRelations();
  }

  const db = getDb();
  const ids = [...versionIds];

  const [categoryRows, tagRows, entityRows, mediaRows, authorRows] =
    await Promise.all([
      db
        .select({
          contentVersionId: contentVersionCategories.contentVersionId,
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          isPrimary: contentVersionCategories.isPrimary,
        })
        .from(contentVersionCategories)
        .innerJoin(
          categories,
          eq(contentVersionCategories.categoryId, categories.id),
        )
        .where(inArray(contentVersionCategories.contentVersionId, ids)),
      db
        .select({
          contentVersionId: contentVersionTags.contentVersionId,
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
        })
        .from(contentVersionTags)
        .innerJoin(tags, eq(contentVersionTags.tagId, tags.id))
        .where(inArray(contentVersionTags.contentVersionId, ids)),
      db
        .select({
          contentVersionId: contentVersionEntities.contentVersionId,
          id: entities.id,
          name: entities.canonicalName,
          kind: entities.kind,
          role: contentVersionEntities.role,
          sortOrder: contentVersionEntities.sortOrder,
        })
        .from(contentVersionEntities)
        .innerJoin(entities, eq(contentVersionEntities.entityId, entities.id))
        .where(inArray(contentVersionEntities.contentVersionId, ids)),
      db
        .select({
          contentVersionId: contentVersionMedia.contentVersionId,
          id: media.id,
          mediaType: media.mediaType,
          width: media.width,
          height: media.height,
          role: contentVersionMedia.role,
          sortOrder: contentVersionMedia.sortOrder,
          caption: contentVersionMedia.caption,
          altText: contentVersionMedia.altText,
          credit: contentVersionMedia.credit,
        })
        .from(contentVersionMedia)
        .innerJoin(media, eq(contentVersionMedia.mediaId, media.id))
        .where(inArray(contentVersionMedia.contentVersionId, ids)),
      db
        .select({
          contentVersionId: contentVersionAuthors.contentVersionId,
          id: authors.id,
          displayName: authors.displayName,
          slug: authors.slug,
          role: contentVersionAuthors.role,
          sortOrder: contentVersionAuthors.sortOrder,
        })
        .from(contentVersionAuthors)
        .innerJoin(authors, eq(contentVersionAuthors.authorId, authors.id))
        .where(inArray(contentVersionAuthors.contentVersionId, ids)),
    ]);

  return {
    categories: categoryRows,
    tags: tagRows,
    entities: entityRows,
    media: mediaRows.map((row) => ({
      contentVersionId: row.contentVersionId,
      id: row.id,
      label: formatEditorMediaLabel(row),
      role: row.role,
      sortOrder: row.sortOrder,
      caption: row.caption,
      altText: row.altText,
      credit: row.credit,
    })),
    authors: authorRows,
  };
}

function toSide(
  version: VersionRow,
  access: EditorContentAccess,
  relations: Awaited<ReturnType<typeof loadLabeledRelations>>,
): ContentVersionDiffSideInput {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    workflowStatus: version.workflowStatus,
    createdAt: asDate(version.createdAt),
    isCurrentDraft: version.id === access.draftVersionId,
    isPublishedVersion: version.id === access.publishedVersionId,
    isScheduledVersion: version.id === access.scheduledVersionId,
    title: version.title,
    subtitle: version.subtitle,
    excerpt: version.excerpt,
    seoTitle: version.seoTitle,
    seoDescription: version.seoDescription,
    canonicalUrl: version.canonicalUrl,
    robots: version.robots,
    credibility: version.credibility,
    credibilitySource: version.credibilitySource,
    source: version.source,
    sourceOrganization: version.sourceOrganization,
    sourceUrl: version.sourceUrl,
    syndicated: version.syndicated,
    isMaterialUpdate: version.isMaterialUpdate,
    body: version.body,
    categories: relations.categories
      .filter((row) => row.contentVersionId === version.id)
      .map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        isPrimary: row.isPrimary,
      })),
    tags: relations.tags
      .filter((row) => row.contentVersionId === version.id)
      .map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
      })),
    entities: relations.entities
      .filter((row) => row.contentVersionId === version.id)
      .map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        role: row.role,
        sortOrder: row.sortOrder,
      })),
    media: relations.media
      .filter((row) => row.contentVersionId === version.id)
      .map((row) => ({
        id: row.id,
        label: row.label,
        role: row.role,
        sortOrder: row.sortOrder,
        caption: row.caption,
        altText: row.altText,
        credit: row.credit,
      })),
    authors: relations.authors
      .filter((row) => row.contentVersionId === version.id)
      .map((row) => ({
        id: row.id,
        displayName: row.displayName,
        slug: row.slug,
        role: row.role,
        sortOrder: row.sortOrder,
      })),
  };
}

/**
 * Read-only semantic comparison of two ContentVersions.
 *
 * Authorization is decided from the ContentItem display-version primary
 * category before either version body or relation payload is returned.
 * Version UUIDs are loaded only after that check, and only when they belong
 * to the authorized item. Cross-item version IDs are masked as VERSION_NOT_FOUND.
 */
export async function getContentVersionDiff(
  contentItemId: string,
  fromVersionId: string,
  toVersionId: string,
  scope: EditorStaffScope,
): Promise<ContentVersionDiff> {
  if (!isUuid(contentItemId)) {
    throw new PublishingError(PUBLISHING_ERROR.CONTENT_NOT_FOUND);
  }

  if (!isUuid(fromVersionId) || !isUuid(toVersionId)) {
    throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_FOUND);
  }

  const access = await getEditorContentAccess(contentItemId);
  if (!access) {
    throw new PublishingError(PUBLISHING_ERROR.CONTENT_NOT_FOUND);
  }

  if (
    !canAccessEditorContentByPrimaryCategory({
      ...scope,
      primaryCategoryId: access.displayPrimaryCategoryId,
    })
  ) {
    throw new PublishingError(PUBLISHING_ERROR.CONTENT_NOT_FOUND);
  }

  const requestedIds = [...new Set([fromVersionId, toVersionId])];
  const db = getDb();
  const rows = await db
    .select({
      id: contentVersions.id,
      contentItemId: contentVersions.contentItemId,
      versionNumber: contentVersions.versionNumber,
      workflowStatus: contentVersions.workflowStatus,
      title: contentVersions.title,
      subtitle: contentVersions.subtitle,
      excerpt: contentVersions.excerpt,
      body: contentVersions.body,
      seoTitle: contentVersions.seoTitle,
      seoDescription: contentVersions.seoDescription,
      canonicalUrl: contentVersions.canonicalUrl,
      robots: contentVersions.robots,
      credibility: contentVersions.credibility,
      credibilitySource: contentVersions.credibilitySource,
      source: contentVersions.source,
      sourceOrganization: contentVersions.sourceOrganization,
      sourceUrl: contentVersions.sourceUrl,
      syndicated: contentVersions.syndicated,
      isMaterialUpdate: contentVersions.isMaterialUpdate,
      createdAt: contentVersions.createdAt,
    })
    .from(contentVersions)
    .where(
      and(
        eq(contentVersions.contentItemId, access.id),
        inArray(contentVersions.id, requestedIds),
      ),
    );

  if (rows.length !== requestedIds.length) {
    throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_FOUND);
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const fromRow = byId.get(fromVersionId);
  const toRow = byId.get(toVersionId);
  if (!fromRow || !toRow) {
    throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_FOUND);
  }

  const relations = await loadLabeledRelations(requestedIds);
  return unwrapPublishingDecision(
    diffContentVersions({
      contentItemId: access.id,
      from: toSide(fromRow, access, relations),
      to: toSide(toRow, access, relations),
    }),
  );
}
