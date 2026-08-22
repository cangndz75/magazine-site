import { and, asc, eq, isNull } from "drizzle-orm";
import {
  ANALYTICS_SURFACE,
  CONTENT_KIND,
  KILL_SWITCH_KEY,
  canonicalizeContentSlug,
  canRedirectHistoricalPublicSlug,
  MEDIA_ROLE,
  MEDIA_TYPE,
  MEDIA_RENDITION_SURFACE,
  PUBLIC_GALLERY_IMAGE_SIZES,
  PUBLICATION_STATUS,
  toPublicEditorialVideoProjection,
  publicPublishedVersionId,
  signAnalyticsContext,
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
import { contentSlugHistory } from "../schema/slug-history";
import { contentVersionVideos, editorialVideoAssets } from "../schema/video";
import { categories } from "../schema/taxonomy";
import {
  loadMediaRenditionsByMediaIds,
  resolvePublicImageDelivery,
} from "../media/image-delivery";
import { isKillSwitchActive } from "../feature-controls";
import { alias } from "drizzle-orm/pg-core";
import {
  loadPublicLegalNotices,
  loadPublicWithdrawnArticleShellBySlug,
} from "./load-public-legal";
import { loadPublicArticleEntityLinks } from "./load-public-article-entities";

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

export type PublicArticleEntityLink = {
  entityId: string;
  canonicalName: string;
  slug: string;
  kind: string;
  publicHref: string | null;
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
  | { status: "withdrawn"; shell: PublicWithdrawnArticleShell }
  | { status: "redirect"; toSlug: string; contentItemId: string };

export type PublicArticle = {
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
  body: unknown;
  hero: PublicArticleHeroMedia | null;
  gallery: PublicArticleGalleryItem[];
  videos: PublicEditorialVideoProjection[];
  categories: PublicArticleCategory[];
  authors: PublicArticleAuthor[];
  entities: PublicArticleEntityLink[];
  legalNotices: PublicLegalNotice[];
  analyticsContext?: string;
};

export type PublicArticleReadOptions = {
  mediaPublicBaseUrl?: string;
  analyticsContextSigningKey?: string;
  analyticsContextNow?: Date;
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
        eq(contentItems.contentKind, CONTENT_KIND.ARTICLE),
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
        videoAssetId: editorialVideoAssets.id,
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
  const publicVideoDisabled = await isKillSwitchActive(KILL_SWITCH_KEY.PUBLIC_VIDEO);
  const videos = publicVideoDisabled ? [] : videoRows.flatMap((row) => {
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
    return item ? [{ ...item, videoAssetId: row.videoAssetId }] : [];
  });
  const legalNotices = await loadPublicLegalNotices(item.id);
  const entities = await loadPublicArticleEntityLinks({
    contentItemId: item.id,
    publishedVersionId,
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
    entities,
    legalNotices,
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
  if (article) {
    return { status: "live", article };
  }

  return resolveHistoricalPublicArticleSlug(canonical.value);
}

async function resolveHistoricalPublicArticleSlug(
  oldSlug: string,
): Promise<PublicArticlePage | null> {
  const db = getDb();
  const [history] = await db
    .select({
      contentItemId: contentSlugHistory.contentItemId,
    })
    .from(contentSlugHistory)
    .where(eq(contentSlugHistory.oldSlug, oldSlug))
    .limit(1);

  if (!history) {
    return null;
  }

  const [item] = await db
    .select({
      id: contentItems.id,
      slug: contentItems.slug,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      publishedAt: contentItems.publishedAt,
      deletedAt: contentItems.deletedAt,
    })
    .from(contentItems)
    .where(eq(contentItems.id, history.contentItemId))
    .limit(1);

  if (!item || item.slug === oldSlug) {
    return null;
  }

  if (!canRedirectHistoricalPublicSlug(item)) {
    return null;
  }

  return {
    status: "redirect",
    toSlug: item.slug,
    contentItemId: item.id,
  };
}
