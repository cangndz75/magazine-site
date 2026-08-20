import { and, asc, eq, isNull } from "drizzle-orm";
import {
  canonicalizeContentSlug,
  MEDIA_ROLE,
  MEDIA_TYPE,
  MEDIA_RENDITION_SURFACE,
  PUBLIC_GALLERY_IMAGE_SIZES,
  PUBLICATION_STATUS,
  toPublicEditorialVideoProjection,
  publicPublishedVersionId,
  toPublicArticleGalleryItem,
  type AuthorRole,
  type PublicArticleGalleryItem,
  type PublicEditorialVideoProjection,
  type PublicLegalNotice,
  type PublicWithdrawnArticleShell,
  type VideoProvider,
} from "@magazine/domain";
import { getDb } from "../client";
import { authors } from "../schema/authors";
import {
  contentItems,
  contentVersionAuthors,
  contentVersionCategories,
  contentVersionMedia,
  contentVersions,
} from "../schema/content";
import { media } from "../schema/media";
import { contentVersionVideos, editorialVideoAssets } from "../schema/video";
import { categories } from "../schema/taxonomy";
import {
  loadMediaRenditionsByMediaIds,
  resolvePublicImageDelivery,
} from "../media/image-delivery";
import { alias } from "drizzle-orm/pg-core";
import {
  loadPublicLegalNotices,
  loadPublicWithdrawnArticleShellBySlug,
} from "./load-public-legal";

export type PublicArticleCategory = {
  name: string;
  slug: string;
  isPrimary: boolean;
};

export type PublicArticleAuthor = {
  displayName: string;
  slug: string;
  role: AuthorRole;
};

export type PublicArticleHeroMedia = {
  url: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  credit: string | null;
};

export type { PublicArticleGalleryItem };
export type { PublicEditorialVideoProjection };

export type { PublicLegalNotice, PublicWithdrawnArticleShell };

export type PublicArticlePage =
  | { status: "live"; article: PublicArticle }
  | { status: "withdrawn"; shell: PublicWithdrawnArticleShell };

export type PublicArticle = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  publishedAt: Date;
  publicDateModified: Date | null;
  body: unknown;
  hero: PublicArticleHeroMedia | null;
  gallery: PublicArticleGalleryItem[];
  videos: PublicEditorialVideoProjection[];
  categories: PublicArticleCategory[];
  authors: PublicArticleAuthor[];
  legalNotices: PublicLegalNotice[];
};

export type PublicArticleReadOptions = {
  mediaPublicBaseUrl?: string;
};

/**
 * Public readers resolve by the item's canonical slug, then only through
 * publicationStatus === PUBLISHED and publishedVersionId.
 * Draft, review, scheduled, and unpublished pointers are never substituted.
 */
export async function getPublicArticleBySlug(
  rawSlug: string,
  options: PublicArticleReadOptions = {},
): Promise<PublicArticle | null> {
  const canonical = canonicalizeContentSlug(rawSlug);
  if (!canonical.ok) {
    return null;
  }

  const db = getDb();
  const [item] = await db
    .select({
      id: contentItems.id,
      slug: contentItems.slug,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      publishedAt: contentItems.publishedAt,
      publicDateModified: contentItems.publicDateModified,
      deletedAt: contentItems.deletedAt,
      retractedAt: contentItems.retractedAt,
      takedownAt: contentItems.takedownAt,
    })
    .from(contentItems)
    .where(
      and(
        eq(contentItems.slug, canonical.value),
        isNull(contentItems.deletedAt),
        isNull(contentItems.retractedAt),
        isNull(contentItems.takedownAt),
        eq(contentItems.publicationStatus, PUBLICATION_STATUS.PUBLISHED),
      ),
    )
    .limit(1);

  if (!item) {
    return null;
  }

  const publishedVersionId = publicPublishedVersionId(item);
  if (!publishedVersionId || item.publishedAt === null) {
    return null;
  }

  const [version] = await db
    .select({
      id: contentVersions.id,
      title: contentVersions.title,
      subtitle: contentVersions.subtitle,
      excerpt: contentVersions.excerpt,
      body: contentVersions.body,
    })
    .from(contentVersions)
    .where(
      and(
        eq(contentVersions.id, publishedVersionId),
        eq(contentVersions.contentItemId, item.id),
      ),
    )
    .limit(1);

  if (!version) {
    return null;
  }

  const posterMedia = alias(media, "public_article_video_poster_media");
  const [categoryRows, authorRows, heroRows, galleryRows, videoRows] =
    await Promise.all([
    db
      .select({
        name: categories.name,
        slug: categories.slug,
        isPrimary: contentVersionCategories.isPrimary,
      })
      .from(contentVersionCategories)
      .innerJoin(
        categories,
        eq(categories.id, contentVersionCategories.categoryId),
      )
      .where(eq(contentVersionCategories.contentVersionId, version.id)),
    db
      .select({
        displayName: authors.displayName,
        slug: authors.slug,
        role: contentVersionAuthors.role,
        sortOrder: contentVersionAuthors.sortOrder,
      })
      .from(contentVersionAuthors)
      .innerJoin(authors, eq(authors.id, contentVersionAuthors.authorId))
      .where(eq(contentVersionAuthors.contentVersionId, version.id))
      .orderBy(contentVersionAuthors.sortOrder),
    db
      .select({
        mediaId: media.id,
        storageKey: media.storageKey,
        mediaType: media.mediaType,
        width: media.width,
        height: media.height,
        altText: contentVersionMedia.altText,
        credit: contentVersionMedia.credit,
        creditLine: media.creditLine,
      })
      .from(contentVersionMedia)
      .innerJoin(media, eq(media.id, contentVersionMedia.mediaId))
      .where(
        and(
          eq(contentVersionMedia.contentVersionId, version.id),
          eq(contentVersionMedia.role, MEDIA_ROLE.HERO),
          eq(media.mediaType, MEDIA_TYPE.IMAGE),
        ),
      )
      .limit(1),
    db
      .select({
        mediaId: media.id,
        storageKey: media.storageKey,
        mediaType: media.mediaType,
        width: media.width,
        height: media.height,
        altText: contentVersionMedia.altText,
        caption: contentVersionMedia.caption,
        credit: contentVersionMedia.credit,
        creditLine: media.creditLine,
        sortOrder: contentVersionMedia.sortOrder,
      })
      .from(contentVersionMedia)
      .innerJoin(media, eq(media.id, contentVersionMedia.mediaId))
      .where(
        and(
          eq(contentVersionMedia.contentVersionId, version.id),
          eq(contentVersionMedia.role, MEDIA_ROLE.GALLERY),
        ),
      )
      .orderBy(asc(contentVersionMedia.sortOrder)),
    db
      .select({
        provider: editorialVideoAssets.provider,
        providerVideoId: editorialVideoAssets.providerVideoId,
        title: editorialVideoAssets.title,
        assetCaption: editorialVideoAssets.caption,
        relationCaption: contentVersionVideos.caption,
        durationSeconds: editorialVideoAssets.durationSeconds,
        posterMediaId: posterMedia.id,
        posterStorageKey: posterMedia.storageKey,
        posterMediaType: posterMedia.mediaType,
        posterWidth: posterMedia.width,
        posterHeight: posterMedia.height,
        posterCreditLine: posterMedia.creditLine,
      })
      .from(contentVersionVideos)
      .innerJoin(
        editorialVideoAssets,
        eq(editorialVideoAssets.id, contentVersionVideos.videoAssetId),
      )
      .leftJoin(posterMedia, eq(posterMedia.id, editorialVideoAssets.posterMediaId))
      .where(eq(contentVersionVideos.contentVersionId, version.id))
      .orderBy(asc(contentVersionVideos.sortOrder)),
  ]);

  const renditionsByMediaId = await loadMediaRenditionsByMediaIds([
    ...heroRows.map((row) => row.mediaId),
    ...galleryRows.map((row) => row.mediaId),
    ...videoRows
      .map((row) => row.posterMediaId)
      .filter((id): id is string => Boolean(id)),
  ]);

  const publicCategories = [...categoryRows].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }
    return left.name.localeCompare(right.name, "tr");
  });
  const heroRow = heroRows[0];
  const heroDelivery = heroRow
    ? resolvePublicImageDelivery({
        mediaPublicBaseUrl: options.mediaPublicBaseUrl,
        originalStorageKey: heroRow.storageKey,
        originalWidth: heroRow.width,
        originalHeight: heroRow.height,
        renditions: renditionsByMediaId.get(heroRow.mediaId),
        surface: MEDIA_RENDITION_SURFACE.ARTICLE_HERO,
      })
    : null;
  const gallery = galleryRows.flatMap((row) => {
    const stage = resolvePublicImageDelivery({
      mediaPublicBaseUrl: options.mediaPublicBaseUrl,
      originalStorageKey: row.storageKey,
      originalWidth: row.width,
      originalHeight: row.height,
      renditions: renditionsByMediaId.get(row.mediaId),
      surface: MEDIA_RENDITION_SURFACE.GALLERY_STAGE,
    });
    const item = toPublicArticleGalleryItem({
      mediaId: row.mediaId,
      mediaType: row.mediaType,
      publicUrl: stage.url,
      width: stage.width,
      height: stage.height,
      altText: row.altText,
      caption: row.caption,
      attachmentCredit: row.credit,
      creditLine: row.creditLine,
      thumbUrl: stage.thumbUrl,
      srcSet: stage.srcSet,
      sizes: stage.srcSet ? PUBLIC_GALLERY_IMAGE_SIZES : null,
    });
    return item ? [item] : [];
  });
  const videos = videoRows.flatMap((row) => {
    const posterDelivery =
      row.posterStorageKey && row.posterMediaType === MEDIA_TYPE.IMAGE
        ? resolvePublicImageDelivery({
            mediaPublicBaseUrl: options.mediaPublicBaseUrl,
            originalStorageKey: row.posterStorageKey,
            originalWidth: row.posterWidth,
            originalHeight: row.posterHeight,
            renditions: row.posterMediaId
              ? renditionsByMediaId.get(row.posterMediaId)
              : undefined,
            surface: MEDIA_RENDITION_SURFACE.VIDEO_POSTER,
          })
        : null;
    const item = toPublicEditorialVideoProjection({
      provider: row.provider as VideoProvider,
      providerVideoId: row.providerVideoId,
      title: row.title,
      caption: row.relationCaption ?? row.assetCaption,
      durationSeconds: row.durationSeconds,
      editorialPoster:
        posterDelivery?.url
          ? {
              publicUrl: posterDelivery.url,
              width: posterDelivery.width,
              height: posterDelivery.height,
              altText: row.title,
              attachmentCredit: null,
              creditLine: row.posterCreditLine,
            }
          : null,
    });
    return item ? [item] : [];
  });
  const legalNotices = await loadPublicLegalNotices(item.id);

  return {
    id: item.id,
    slug: item.slug,
    title: version.title,
    subtitle: version.subtitle,
    excerpt: version.excerpt,
    publishedAt: item.publishedAt,
    publicDateModified: item.publicDateModified,
    body: version.body,
    hero:
      heroRow && heroDelivery?.url
        ? {
            url: heroDelivery.url,
            width: heroDelivery.width,
            height: heroDelivery.height,
            altText: heroRow.altText,
            credit: heroRow.credit?.trim() || heroRow.creditLine?.trim() || null,
          }
        : null,
    gallery,
    videos,
    categories: publicCategories,
    authors: authorRows.map((row) => ({
      displayName: row.displayName,
      slug: row.slug,
      role: row.role,
    })),
    legalNotices,
  };
}

export async function getPublicArticlePageBySlug(
  rawSlug: string,
  options: PublicArticleReadOptions = {},
): Promise<PublicArticlePage | null> {
  const canonical = canonicalizeContentSlug(rawSlug);
  if (!canonical.ok) {
    return null;
  }

  const withdrawnShell = await loadPublicWithdrawnArticleShellBySlug(
    canonical.value,
  );
  if (withdrawnShell) {
    return { status: "withdrawn", shell: withdrawnShell };
  }

  const article = await getPublicArticleBySlug(canonical.value, options);
  if (!article) {
    return null;
  }

  return { status: "live", article };
}
