import { and, eq } from "drizzle-orm";
import {
  MEDIA_ROLE,
  MEDIA_RENDITION_SURFACE,
  PUBLICATION_STATUS,
  toPublicMediaProjection,
  type PublicMediaProjection,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersionMedia } from "../schema/content";
import { media } from "../schema/media";
import { loadMediaRenditionsByMediaIds, resolvePublicImageDelivery } from "../media/image-delivery";

/**
 * Public HERO for an article comes only from the version pointed to by
 * publishedVersionId while publicationStatus is PUBLISHED.
 */
export async function loadPublishedHeroMedia(input: {
  contentItemId: string;
  mediaPublicBaseUrl: string | undefined;
}): Promise<PublicMediaProjection | null> {
  const db = getDb();
  const [item] = await db
    .select({
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
    })
    .from(contentItems)
    .where(eq(contentItems.id, input.contentItemId))
    .limit(1);

  if (
    !item ||
    item.publicationStatus !== PUBLICATION_STATUS.PUBLISHED ||
    item.publishedVersionId === null
  ) {
    return null;
  }

  const [hero] = await db
    .select({
      mediaId: media.id,
      storageKey: media.storageKey,
      width: media.width,
      height: media.height,
      creditLine: media.creditLine,
      altText: contentVersionMedia.altText,
      credit: contentVersionMedia.credit,
    })
    .from(contentVersionMedia)
    .innerJoin(media, eq(contentVersionMedia.mediaId, media.id))
    .where(
      and(
        eq(contentVersionMedia.contentVersionId, item.publishedVersionId),
        eq(contentVersionMedia.role, MEDIA_ROLE.HERO),
      ),
    )
    .limit(1);

  if (!hero) {
    return null;
  }

  const renditionsByMediaId = await loadMediaRenditionsByMediaIds([hero.mediaId]);
  const delivery = resolvePublicImageDelivery({
    mediaPublicBaseUrl: input.mediaPublicBaseUrl,
    originalStorageKey: hero.storageKey,
    originalWidth: hero.width,
    originalHeight: hero.height,
    renditions: renditionsByMediaId.get(hero.mediaId),
    surface: MEDIA_RENDITION_SURFACE.ARTICLE_HERO,
  });

  return toPublicMediaProjection({
    publicUrl: delivery.url,
    width: delivery.width,
    height: delivery.height,
    altText: hero.altText,
    attachmentCredit: hero.credit,
    creditLine: hero.creditLine,
  });
}
