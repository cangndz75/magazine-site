import { and, eq, inArray } from "drizzle-orm";
import {
  MEDIA_ROLE,
  MEDIA_RENDITION_SURFACE,
  selectEditorHomepageHeroVersionId,
  toEditorSafeHeroThumbnail,
  type EditorSafeHeroThumbnail,
  type PublicationStatus,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentVersionMedia } from "../schema/content";
import { media } from "../schema/media";
import { loadMediaRenditionsByMediaIds } from "../media/image-delivery";
import { previewUrlForImageSurface } from "./media-projections";

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
        inArray(contentVersionMedia.contentVersionId, versionIds),
        eq(contentVersionMedia.role, MEDIA_ROLE.HERO),
      ),
    );

  const renditionsByMediaId = await loadMediaRenditionsByMediaIds(
    rows.map((row) => row.mediaId),
  );

  for (const row of rows) {
    const thumbnail = toEditorSafeHeroThumbnail({
      mediaType: row.mediaType,
      publicUrl: previewUrlForImageSurface({
        mediaPublicBaseUrl: input.mediaPublicBaseUrl,
        originalStorageKey: row.storageKey,
        originalWidth: row.width,
        originalHeight: row.height,
        renditions: renditionsByMediaId.get(row.mediaId),
        surface: MEDIA_RENDITION_SURFACE.HOMEPAGE_THUMB,
      }),
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
