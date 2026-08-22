import { and, asc, eq, isNull } from "drizzle-orm";
import {
  ANALYTICS_SURFACE,
  CONTENT_KIND,
  MEDIA_RENDITION_SURFACE,
  MEDIA_ROLE,
  MEDIA_TYPE,
  PUBLICATION_STATUS,
  PUBLIC_GALLERY_IMAGE_SIZES,
  canonicalizeContentSlug,
  publicPublishedVersionId,
  signAnalyticsContext,
  toPublicArticleGalleryItem,
  type PublicArticleGalleryItem,
  type PublicLegalNotice,
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
import { categories } from "../schema/taxonomy";
import {
  loadMediaRenditionsByMediaIds,
  resolvePublicImageDelivery,
} from "../media/image-delivery";
import type {
  PublicArticleAuthor,
  PublicArticleCategory,
  PublicArticleHeroMedia,
  PublicArticleReadOptions,
} from "./get-public-article";
import { loadPublicLegalNotices } from "./load-public-legal";

export type PublicPhotoGallery = {
  id: string;
  publishedVersionId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  publishedAt: Date;
  publicDateModified: Date | null;
  cover: PublicArticleHeroMedia;
  images: PublicArticleGalleryItem[];
  categories: PublicArticleCategory[];
  authors: PublicArticleAuthor[];
  legalNotices: PublicLegalNotice[];
  analyticsContext?: string;
};

export async function getPublicPhotoGalleryBySlug(
  rawSlug: string,
  options: PublicArticleReadOptions = {},
): Promise<PublicPhotoGallery | null> {
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
        eq(contentItems.contentKind, CONTENT_KIND.GALLERY),
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
      seoTitle: contentVersions.seoTitle,
      seoDescription: contentVersions.seoDescription,
      canonicalUrl: contentVersions.canonicalUrl,
      robots: contentVersions.robots,
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

  const [categoryRows, authorRows, mediaRows] = await Promise.all([
    db
      .select({
        name: categories.name,
        slug: categories.slug,
        isPrimary: contentVersionCategories.isPrimary,
      })
      .from(contentVersionCategories)
      .innerJoin(categories, eq(categories.id, contentVersionCategories.categoryId))
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
        role: contentVersionMedia.role,
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
          eq(media.mediaType, MEDIA_TYPE.IMAGE),
        ),
      )
      .orderBy(asc(contentVersionMedia.sortOrder)),
  ]);

  const renditionsByMediaId = await loadMediaRenditionsByMediaIds(
    mediaRows.map((row) => row.mediaId),
  );
  const coverRow = mediaRows.find((row) => row.role === MEDIA_ROLE.HERO);
  if (!coverRow) {
    return null;
  }
  const coverDelivery = resolvePublicImageDelivery({
    mediaPublicBaseUrl: options.mediaPublicBaseUrl,
    originalStorageKey: coverRow.storageKey,
    originalWidth: coverRow.width,
    originalHeight: coverRow.height,
    renditions: renditionsByMediaId.get(coverRow.mediaId),
    surface: MEDIA_RENDITION_SURFACE.ARTICLE_HERO,
  });
  if (!coverDelivery.url) {
    return null;
  }

  const images = mediaRows.flatMap((row) => {
    if (row.role !== MEDIA_ROLE.GALLERY) {
      return [];
    }
    const delivery = resolvePublicImageDelivery({
      mediaPublicBaseUrl: options.mediaPublicBaseUrl,
      originalStorageKey: row.storageKey,
      originalWidth: row.width,
      originalHeight: row.height,
      renditions: renditionsByMediaId.get(row.mediaId),
      surface: MEDIA_RENDITION_SURFACE.GALLERY_STAGE,
    });
    const projected = toPublicArticleGalleryItem({
      mediaId: row.mediaId,
      mediaType: row.mediaType,
      publicUrl: delivery.url,
      width: delivery.width,
      height: delivery.height,
      altText: row.altText,
      caption: row.caption,
      attachmentCredit: row.credit,
      creditLine: row.creditLine,
      thumbUrl: delivery.thumbUrl,
      srcSet: delivery.srcSet,
      sizes: delivery.srcSet ? PUBLIC_GALLERY_IMAGE_SIZES : null,
    });
    return projected ? [projected] : [];
  });

  if (images.length === 0) {
    return null;
  }

  const publicCategories = [...categoryRows].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }
    return left.name.localeCompare(right.name, "tr");
  });

  return {
    id: item.id,
    publishedVersionId,
    slug: item.slug,
    title: version.title,
    subtitle: version.subtitle,
    excerpt: version.excerpt,
    seoTitle: version.seoTitle,
    seoDescription: version.seoDescription,
    canonicalUrl: version.canonicalUrl,
    robots: version.robots,
    publishedAt: item.publishedAt,
    publicDateModified: item.publicDateModified,
    cover: {
      url: coverDelivery.url,
      width: coverDelivery.width,
      height: coverDelivery.height,
      altText: coverRow.altText,
      credit: coverRow.credit?.trim() || coverRow.creditLine?.trim() || null,
    },
    images,
    categories: publicCategories,
    authors: authorRows.map((row) => ({
      displayName: row.displayName,
      slug: row.slug,
      role: row.role,
    })),
    legalNotices: await loadPublicLegalNotices(item.id),
    ...(options.analyticsContextSigningKey
      ? {
          analyticsContext: signAnalyticsContext({
            signingKey: options.analyticsContextSigningKey,
            now: options.analyticsContextNow ?? new Date(),
            surface: ANALYTICS_SURFACE.ARTICLE,
            contentItemId: item.id,
            publishedVersionId,
          }),
        }
      : {}),
  };
}
