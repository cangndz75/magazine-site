import { and, asc, eq, isNull } from "drizzle-orm";
import {
  canonicalizeContentSlug,
  MEDIA_ROLE,
  MEDIA_TYPE,
  PUBLICATION_STATUS,
  toPublicEditorialVideoProjection,
  publicPublishedVersionId,
  toPublicArticleGalleryItem,
  type AuthorRole,
  type PublicArticleGalleryItem,
  type PublicEditorialVideoProjection,
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
import { resolvePublicMediaUrl } from "./resolve-public-media-url";
import { alias } from "drizzle-orm/pg-core";

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
    })
    .from(contentItems)
    .where(
      and(
        eq(contentItems.slug, canonical.value),
        isNull(contentItems.deletedAt),
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

  const publicCategories = [...categoryRows].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }
    return left.name.localeCompare(right.name, "tr");
  });
  const heroRow = heroRows[0];
  const heroUrl = heroRow
    ? resolvePublicMediaUrl(options.mediaPublicBaseUrl, heroRow.storageKey)
    : null;
  const gallery = galleryRows.flatMap((row) => {
    const item = toPublicArticleGalleryItem({
      mediaId: row.mediaId,
      mediaType: row.mediaType,
      publicUrl: resolvePublicMediaUrl(options.mediaPublicBaseUrl, row.storageKey),
      width: row.width,
      height: row.height,
      altText: row.altText,
      caption: row.caption,
      attachmentCredit: row.credit,
      creditLine: row.creditLine,
    });
    return item ? [item] : [];
  });
  const videos = videoRows.flatMap((row) => {
    const posterUrl =
      row.posterStorageKey && row.posterMediaType === MEDIA_TYPE.IMAGE
        ? resolvePublicMediaUrl(options.mediaPublicBaseUrl, row.posterStorageKey)
        : null;
    const item = toPublicEditorialVideoProjection({
      provider: row.provider as VideoProvider,
      providerVideoId: row.providerVideoId,
      title: row.title,
      caption: row.relationCaption ?? row.assetCaption,
      durationSeconds: row.durationSeconds,
      editorialPoster:
        posterUrl !== null
          ? {
              publicUrl: posterUrl,
              width: row.posterWidth,
              height: row.posterHeight,
              altText: row.title,
              attachmentCredit: null,
              creditLine: row.posterCreditLine,
            }
          : null,
    });
    return item ? [item] : [];
  });

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
      heroRow && heroUrl
        ? {
            url: heroUrl,
            width: heroRow.width,
            height: heroRow.height,
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
  };
}
