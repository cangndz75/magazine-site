import { and, eq } from "drizzle-orm";
import {
  MEDIA_ROLE,
  PUBLICATION_STATUS,
  toPublicMediaProjection,
  type PublicMediaProjection,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersionMedia } from "../schema/content";
import { media } from "../schema/media";
import { resolvePublicMediaUrl } from "./resolve-public-media-url";

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

  return toPublicMediaProjection({
    publicUrl: resolvePublicMediaUrl(input.mediaPublicBaseUrl, hero.storageKey),
    width: hero.width,
    height: hero.height,
    altText: hero.altText,
    attachmentCredit: hero.credit,
    creditLine: hero.creditLine,
  });
}
