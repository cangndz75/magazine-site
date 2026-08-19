import { and, eq, inArray } from "drizzle-orm";
import {
  MEDIA_ROLE,
  selectEditorHomepageHeroVersionId,
  toEditorSafeHeroThumbnail,
  type EditorSafeHeroThumbnail,
  type PublicationStatus,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentVersionMedia } from "../schema/content";
import { media } from "../schema/media";
import { resolvePublicMediaUrl } from "../public/resolve-public-media-url";

export type EditorHeroThumbnailLookupItem = {
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  displayVersionId: string | null;
};

export async function loadEditorHeroThumbnailsByVersionIds(input: {
  versionIds: readonly string[];
  mediaPublicBaseUrl: string | undefined;
}): Promise<Map<string, EditorSafeHeroThumbnail>> {
  const versionIds = [
    ...new Set(input.versionIds.filter((versionId) => versionId.length > 0)),
  ];
  const thumbnails = new Map<string, EditorSafeHeroThumbnail>();
  if (versionIds.length === 0) {
    return thumbnails;
  }

  const db = getDb();
  const rows = await db
    .select({
      contentVersionId: contentVersionMedia.contentVersionId,
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
        inArray(contentVersionMedia.contentVersionId, versionIds),
        eq(contentVersionMedia.role, MEDIA_ROLE.HERO),
      ),
    );

  for (const row of rows) {
    const thumbnail = toEditorSafeHeroThumbnail({
      mediaType: row.mediaType,
      publicUrl: resolvePublicMediaUrl(input.mediaPublicBaseUrl, row.storageKey),
      width: row.width,
      height: row.height,
      altText: row.altText,
      credit: row.credit?.trim() || row.creditLine,
    });
    if (thumbnail) {
      thumbnails.set(row.contentVersionId, thumbnail);
    }
  }

  return thumbnails;
}

export function heroThumbnailForEditorItem(
  item: EditorHeroThumbnailLookupItem,
  thumbnailsByVersionId: ReadonlyMap<string, EditorSafeHeroThumbnail>,
): EditorSafeHeroThumbnail | null {
  const versionId = selectEditorHomepageHeroVersionId(item);
  if (!versionId) {
    return null;
  }
  return thumbnailsByVersionId.get(versionId) ?? null;
}
