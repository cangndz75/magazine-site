import { and, asc, eq, inArray } from "drizzle-orm";
import {
  MEDIA_ROLE,
  MEDIA_TYPE,
  MEDIA_RENDITION_SURFACE,
  PUBLIC_HOMEPAGE_CONVERSATION_LIMIT,
  assignPublicConversationRanks,
  publicConversationArticlePointer,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersionMedia } from "../schema/content";
import { homepageConversationItems } from "../schema/homepage-conversation";
import { media } from "../schema/media";
import type {
  PublicArticleHeroMedia,
  PublicArticleReadOptions,
} from "./get-public-article";
import {
  loadMediaRenditionsByMediaIds,
  resolvePublicImageDelivery,
} from "../media/image-delivery";

export type PublicHomepageConversationArticle = {
  id: string;
  slug: string;
  publishedVersionId: string;
  hero: PublicArticleHeroMedia | null;
};

export type PublicHomepageConversationItem = {
  rank: number;
  label: string;
  reason: string | null;
  article: PublicHomepageConversationArticle | null;
};

export async function getPublicHomepageConversation(
  options: PublicArticleReadOptions = {},
): Promise<PublicHomepageConversationItem[]> {
  const db = getDb();
    const rows = await db
      .select({
        label: homepageConversationItems.label,
        reason: homepageConversationItems.reason,
        linkedId: contentItems.id,
        slug: contentItems.slug,
        publicationStatus: contentItems.publicationStatus,
        publishedVersionId: contentItems.publishedVersionId,
        deletedAt: contentItems.deletedAt,
        retractedAt: contentItems.retractedAt,
        takedownAt: contentItems.takedownAt,
      })
    .from(homepageConversationItems)
    .leftJoin(
      contentItems,
      eq(contentItems.id, homepageConversationItems.contentItemId),
    )
    .where(eq(homepageConversationItems.isActive, true))
    .orderBy(
      asc(homepageConversationItems.sortOrder),
      asc(homepageConversationItems.id),
    )
    .limit(PUBLIC_HOMEPAGE_CONVERSATION_LIMIT);

  const pointers = rows.map((row) =>
    publicConversationArticlePointer({
      contentItemId: row.linkedId,
      publicationStatus: row.publicationStatus,
      publishedVersionId: row.publishedVersionId,
      deletedAt: row.deletedAt,
      retractedAt: row.retractedAt,
      takedownAt: row.takedownAt,
    }),
  );

  const versionIds = pointers
    .map((pointer) => pointer?.publishedVersionId)
    .filter((id): id is string => id !== undefined);

  const heroByVersion = new Map<string, PublicArticleHeroMedia>();
  if (versionIds.length > 0) {
    const heroRows = await db
      .select({
        contentVersionId: contentVersionMedia.contentVersionId,
        mediaId: media.id,
        storageKey: media.storageKey,
        width: media.width,
        height: media.height,
        altText: contentVersionMedia.altText,
        credit: contentVersionMedia.credit,
      })
      .from(contentVersionMedia)
      .innerJoin(media, eq(media.id, contentVersionMedia.mediaId))
      .where(
        and(
          inArray(contentVersionMedia.contentVersionId, versionIds),
          eq(contentVersionMedia.role, MEDIA_ROLE.HERO),
          eq(media.mediaType, MEDIA_TYPE.IMAGE),
        ),
      );

    const renditionsByMediaId = await loadMediaRenditionsByMediaIds(
      heroRows.map((row) => row.mediaId),
    );

    for (const row of heroRows) {
      if (heroByVersion.has(row.contentVersionId)) {
        continue;
      }
      const delivery = resolvePublicImageDelivery({
        mediaPublicBaseUrl: options.mediaPublicBaseUrl,
        originalStorageKey: row.storageKey,
        originalWidth: row.width,
        originalHeight: row.height,
        renditions: renditionsByMediaId.get(row.mediaId),
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
        credit: row.credit,
      });
    }
  }

  return assignPublicConversationRanks(
    rows.map((row, index) => {
      const pointer = pointers[index];
      return {
        label: row.label,
        reason: row.reason,
        article:
          pointer && row.slug
            ? {
                id: pointer.contentItemId,
                slug: row.slug,
                publishedVersionId: pointer.publishedVersionId,
                hero: heroByVersion.get(pointer.publishedVersionId) ?? null,
              }
            : null,
      };
    }),
  );
}
