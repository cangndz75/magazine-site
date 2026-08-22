import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  MEDIA_ROLE,
  MEDIA_RENDITION_SURFACE,
  PUBLISHING_ERROR,
  PublishingError,
  selectEditorDisplayVersionId,
  type AuthorRole,
  type ContentKind,
  type EntityKind,
  type EntityRole,
  type EntityStatus,
  type MediaRole,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentVersionAuthors,
  contentVersionCategories,
  contentVersionEntities,
  contentVersionMedia,
  contentVersionTags,
  contentVersions,
} from "../schema/content";
import { categories, tags } from "../schema/taxonomy";
import { authors } from "../schema/authors";
import { entities } from "../schema/entities";
import { media } from "../schema/media";
import { contentVersionVideos, editorialVideoAssets } from "../schema/video";
import type { DraftScalarFields } from "../publishing/update-draft-scalars";
import type { EditorVersionSummary } from "./types";
import { formatEditorMediaLabel } from "./media-label";
import { loadMediaRenditionsByMediaIds } from "../media/image-delivery";
import {
  eligibilityForRow,
  previewUrlForImageSurface,
} from "./media-projections";
import { resolveEditorVideoPoster } from "./video-projections";

const parentCategory = alias(categories, "article_editor_parent_category");
const videoPosterMedia = alias(media, "article_editor_video_poster");

export type ArticleEditorRelationSummary = {
  categories: {
    id: string;
    name: string;
    slug: string;
    parentName: string | null;
    isPrimary: boolean;
  }[];
  authors: {
    id: string;
    displayName: string;
    slug: string;
    role: AuthorRole;
    sortOrder: number;
  }[];
  tags: {
    id: string;
    name: string;
    slug: string;
  }[];
  entities: {
    id: string;
    name: string;
    kind: EntityKind;
    status: EntityStatus;
    role: EntityRole;
    sortOrder: number;
  }[];
  media: {
    id: string;
    label: string;
    mediaType: string;
    width: number | null;
    height: number | null;
    role: MediaRole;
    sortOrder: number;
    caption: string | null;
    altText: string | null;
    credit: string | null;
    previewUrl: string | null;
    creatorName: string | null;
    creditLine: string | null;
    eligibility: ReturnType<typeof eligibilityForRow> | null;
  }[];
  videos: {
    id: string;
    provider: string;
    providerVideoId: string;
    canonicalUrl: string;
    title: string;
    caption: string | null;
    assetCaption: string | null;
    durationSeconds: number | null;
    posterMediaId: string | null;
    posterPreviewUrl: string | null;
    posterSource: "EDITORIAL" | "PROVIDER" | "NONE";
    rightsNote: string | null;
    provenance: string | null;
    sortOrder: number;
  }[];
};

export type ArticleEditorModel = {
  contentItem: {
    id: string;
    contentKind: ContentKind;
    slug: string;
    publicationStatus: "NEVER_PUBLISHED" | "PUBLISHED" | "UNPUBLISHED";
    publishedVersionId: string | null;
    draftVersionId: string | null;
    scheduledVersionId: string | null;
    scheduledAt: Date | null;
    scheduleGeneration: number;
    publishedAt: Date | null;
    publicDateModified: Date | null;
    updatedAt: Date;
    legalHoldAt: Date | null;
    legalHoldReason: string | null;
    retractedAt: Date | null;
    takedownAt: Date | null;
  };
  displayVersionId: string | null;
  editableVersion: {
    id: string;
    versionNumber: number;
    workflowStatus: "DRAFT" | "IN_REVIEW" | "APPROVED";
    createdAt: Date;
    fields: DraftScalarFields;
    body: Record<string, unknown> | unknown[];
    canEdit: boolean;
    concurrencyToken: Date;
    relations: ArticleEditorRelationSummary;
  } | null;
  publishedVersion: EditorVersionSummary | null;
  draftVersion: EditorVersionSummary | null;
  scheduledVersion: EditorVersionSummary | null;
};

export async function getArticleEditorModel(
  contentItemId: string,
  options?: { focusVersionId?: string | null; mediaPublicBaseUrl?: string },
): Promise<ArticleEditorModel | null> {
  const db = getDb();
  const [item] = await db
    .select({
      id: contentItems.id,
      contentKind: contentItems.contentKind,
      slug: contentItems.slug,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      draftVersionId: contentItems.draftVersionId,
      scheduledVersionId: contentItems.scheduledVersionId,
      scheduledAt: contentItems.scheduledAt,
      scheduleGeneration: contentItems.scheduleGeneration,
      publishedAt: contentItems.publishedAt,
      publicDateModified: contentItems.publicDateModified,
      updatedAt: contentItems.updatedAt,
      legalHoldAt: contentItems.legalHoldAt,
      legalHoldReason: contentItems.legalHoldReason,
      retractedAt: contentItems.retractedAt,
      takedownAt: contentItems.takedownAt,
      deletedAt: contentItems.deletedAt,
    })
    .from(contentItems)
    .where(eq(contentItems.id, contentItemId))
    .limit(1);

  if (!item || item.deletedAt !== null) {
    return null;
  }

  const pointerIds = [
    item.publishedVersionId,
    item.draftVersionId,
    item.scheduledVersionId,
  ].filter((id): id is string => id !== null);

  const summaryRows =
    pointerIds.length === 0
      ? []
      : await db
          .select({
            id: contentVersions.id,
            versionNumber: contentVersions.versionNumber,
            workflowStatus: contentVersions.workflowStatus,
            title: contentVersions.title,
          })
          .from(contentVersions)
          .where(inArray(contentVersions.id, pointerIds));

  const summaries = new Map(
    summaryRows.map((row) => [row.id, row satisfies EditorVersionSummary]),
  );

  const focusVersionId = options?.focusVersionId ?? null;
  const editableVersionId =
    focusVersionId ?? item.draftVersionId ?? selectEditorDisplayVersionId(item);

  if (focusVersionId) {
    const owned = await loadOwnedVersionId(item.id, focusVersionId);
    if (!owned) {
      throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_FOUND);
    }
  }

  const editableVersion = editableVersionId
    ? await loadEditableDraft(editableVersionId, item, options?.mediaPublicBaseUrl)
    : null;

  return {
    contentItem: {
      id: item.id,
      contentKind: item.contentKind,
      slug: item.slug,
      publicationStatus: item.publicationStatus,
      publishedVersionId: item.publishedVersionId,
      draftVersionId: item.draftVersionId,
      scheduledVersionId: item.scheduledVersionId,
      scheduledAt: item.scheduledAt,
      scheduleGeneration: item.scheduleGeneration,
      publishedAt: item.publishedAt,
      publicDateModified: item.publicDateModified,
      updatedAt: item.updatedAt,
      legalHoldAt: item.legalHoldAt,
      legalHoldReason: item.legalHoldReason,
      retractedAt: item.retractedAt,
      takedownAt: item.takedownAt,
    },
    displayVersionId: selectEditorDisplayVersionId(item),
    editableVersion,
    publishedVersion: item.publishedVersionId
      ? (summaries.get(item.publishedVersionId) ?? null)
      : null,
    draftVersion: item.draftVersionId
      ? (summaries.get(item.draftVersionId) ?? null)
      : null,
    scheduledVersion: item.scheduledVersionId
      ? (summaries.get(item.scheduledVersionId) ?? null)
      : null,
  };
}

async function loadOwnedVersionId(
  contentItemId: string,
  versionId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: contentVersions.id })
    .from(contentVersions)
    .where(
      and(
        eq(contentVersions.id, versionId),
        eq(contentVersions.contentItemId, contentItemId),
      ),
    )
    .limit(1);

  return row?.id ?? null;
}

async function loadEditableDraft(
  versionId: string,
  item: {
    draftVersionId: string | null;
    updatedAt: Date;
  },
  mediaPublicBaseUrl?: string,
) {
  const db = getDb();
  const [version] = await db
    .select({
      id: contentVersions.id,
      versionNumber: contentVersions.versionNumber,
      workflowStatus: contentVersions.workflowStatus,
      title: contentVersions.title,
      subtitle: contentVersions.subtitle,
      excerpt: contentVersions.excerpt,
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
      body: contentVersions.body,
      createdAt: contentVersions.createdAt,
    })
    .from(contentVersions)
    .where(eq(contentVersions.id, versionId))
    .limit(1);

  if (!version) {
    return null;
  }

  return {
    id: version.id,
    versionNumber: version.versionNumber,
    workflowStatus: version.workflowStatus,
    createdAt: version.createdAt,
    fields: {
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
    },
    body: version.body as Record<string, unknown> | unknown[],
    canEdit:
      version.workflowStatus === "DRAFT" && version.id === item.draftVersionId,
    concurrencyToken: item.updatedAt,
    relations: await loadRelationSummary(version.id, mediaPublicBaseUrl),
  };
}

async function loadRelationSummary(
  versionId: string,
  mediaPublicBaseUrl?: string,
): Promise<ArticleEditorRelationSummary> {
  const db = getDb();
  const [categoryRows, authorRows, tagRows, entityRows, mediaRows, videoRows] =
    await Promise.all([
      db
        .select({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          parentName: parentCategory.name,
          isPrimary: contentVersionCategories.isPrimary,
        })
        .from(contentVersionCategories)
        .innerJoin(
          categories,
          eq(categories.id, contentVersionCategories.categoryId),
        )
        .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
        .where(eq(contentVersionCategories.contentVersionId, versionId)),
      db
        .select({
          id: authors.id,
          displayName: authors.displayName,
          slug: authors.slug,
          role: contentVersionAuthors.role,
          sortOrder: contentVersionAuthors.sortOrder,
        })
        .from(contentVersionAuthors)
        .innerJoin(authors, eq(authors.id, contentVersionAuthors.authorId))
        .where(eq(contentVersionAuthors.contentVersionId, versionId))
        .orderBy(contentVersionAuthors.sortOrder),
      db
        .select({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
        })
        .from(contentVersionTags)
        .innerJoin(tags, eq(tags.id, contentVersionTags.tagId))
        .where(eq(contentVersionTags.contentVersionId, versionId))
        .orderBy(tags.name),
      db
        .select({
          id: entities.id,
          name: entities.canonicalName,
          kind: entities.kind,
          status: entities.status,
          role: contentVersionEntities.role,
          sortOrder: contentVersionEntities.sortOrder,
        })
        .from(contentVersionEntities)
        .innerJoin(entities, eq(entities.id, contentVersionEntities.entityId))
        .where(eq(contentVersionEntities.contentVersionId, versionId))
        .orderBy(contentVersionEntities.sortOrder),
      db
        .select({
          row: media,
          role: contentVersionMedia.role,
          sortOrder: contentVersionMedia.sortOrder,
          caption: contentVersionMedia.caption,
          altText: contentVersionMedia.altText,
          credit: contentVersionMedia.credit,
        })
        .from(contentVersionMedia)
        .innerJoin(media, eq(media.id, contentVersionMedia.mediaId))
        .where(eq(contentVersionMedia.contentVersionId, versionId))
        .orderBy(contentVersionMedia.role, contentVersionMedia.sortOrder),
      db
        .select({
          asset: editorialVideoAssets,
          sortOrder: contentVersionVideos.sortOrder,
          relationCaption: contentVersionVideos.caption,
          posterMediaId: videoPosterMedia.id,
          posterStorageKey: videoPosterMedia.storageKey,
          posterWidth: videoPosterMedia.width,
          posterHeight: videoPosterMedia.height,
        })
        .from(contentVersionVideos)
        .innerJoin(
          editorialVideoAssets,
          eq(editorialVideoAssets.id, contentVersionVideos.videoAssetId),
        )
        .leftJoin(
          videoPosterMedia,
          eq(videoPosterMedia.id, editorialVideoAssets.posterMediaId),
        )
        .where(eq(contentVersionVideos.contentVersionId, versionId))
        .orderBy(contentVersionVideos.sortOrder),
    ]);

  const renditionsByMediaId = await loadMediaRenditionsByMediaIds([
    ...mediaRows.map((item) => item.row.id),
    ...videoRows
      .map((item) => item.posterMediaId)
      .filter((id): id is string => Boolean(id)),
  ]);

  return {
    categories: categoryRows,
    authors: authorRows,
    tags: tagRows,
    entities: entityRows,
    media: mediaRows.map((item) => ({
      id: item.row.id,
      label: formatEditorMediaLabel(item.row),
      mediaType: item.row.mediaType,
      width: item.row.width,
      height: item.row.height,
      role: item.role,
      sortOrder: item.sortOrder,
      caption: item.caption,
      altText: item.altText,
      credit: item.credit,
      previewUrl: previewUrlForImageSurface({
        mediaPublicBaseUrl,
        originalStorageKey: item.row.storageKey,
        originalWidth: item.row.width,
        originalHeight: item.row.height,
        renditions: renditionsByMediaId.get(item.row.id),
        surface:
          item.role === MEDIA_ROLE.HERO
            ? MEDIA_RENDITION_SURFACE.ARTICLE_HERO
            : MEDIA_RENDITION_SURFACE.GALLERY_THUMB,
      }),
      creatorName: item.row.creatorName,
      creditLine: item.row.creditLine,
      eligibility: eligibilityForRow(item.row, new Date()),
    })),
    videos: videoRows.map((item) => {
      const poster = resolveEditorVideoPoster({
        provider: item.asset.provider,
        providerVideoId: item.asset.providerVideoId,
        posterMediaId: item.asset.posterMediaId,
        posterRow: item.posterStorageKey
          ? {
              storageKey: item.posterStorageKey,
              width: item.posterWidth,
              height: item.posterHeight,
              renditions: item.posterMediaId
                ? renditionsByMediaId.get(item.posterMediaId)
                : undefined,
            }
          : null,
        mediaPublicBaseUrl,
      });
      return {
        id: item.asset.id,
        provider: item.asset.provider,
        providerVideoId: item.asset.providerVideoId,
        canonicalUrl: item.asset.canonicalUrl,
        title: item.asset.title,
        caption: item.relationCaption,
        assetCaption: item.asset.caption,
        durationSeconds: item.asset.durationSeconds,
        posterMediaId: item.asset.posterMediaId,
        posterPreviewUrl: poster.posterPreviewUrl,
        posterSource: poster.posterSource,
        rightsNote: item.asset.rightsNote,
        provenance: item.asset.provenance,
        sortOrder: item.sortOrder,
      };
    }),
  };
}
