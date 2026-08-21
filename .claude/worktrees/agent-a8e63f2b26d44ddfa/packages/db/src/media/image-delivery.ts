import { inArray } from "drizzle-orm";
import {
  MEDIA_RENDITION_SURFACE,
  buildPublicImageSrcSet,
  isMediaRenditionVariant,
  selectResolvedImageDelivery,
  type MediaRenditionSurface,
  type MediaRenditionVariant,
  type ResolvedMediaRendition,
} from "@magazine/domain";
import { getDb } from "../client";
import { mediaRenditions } from "../schema/media";
import { resolvePublicMediaUrl } from "../public/resolve-public-media-url";

export type StoredMediaRendition = {
  mediaId: string;
  variant: MediaRenditionVariant;
  storageKey: string;
  width: number;
  height: number;
  byteSize: number;
};

export type PublicImageDelivery = {
  url: string | null;
  width: number | null;
  height: number | null;
  srcSet: string | null;
  thumbUrl: string | null;
};

export async function loadMediaRenditionsByMediaIds(
  mediaIds: readonly string[],
): Promise<Map<string, StoredMediaRendition[]>> {
  const ids = [...new Set(mediaIds.filter((id) => id.length > 0))];
  const byMediaId = new Map<string, StoredMediaRendition[]>();
  if (ids.length === 0) {
    return byMediaId;
  }

  const db = getDb();
  const rows = await db
    .select({
      mediaId: mediaRenditions.mediaId,
      variant: mediaRenditions.variant,
      storageKey: mediaRenditions.storageKey,
      width: mediaRenditions.width,
      height: mediaRenditions.height,
      byteSize: mediaRenditions.byteSize,
    })
    .from(mediaRenditions)
    .where(inArray(mediaRenditions.mediaId, ids));

  for (const row of rows) {
    if (!isMediaRenditionVariant(row.variant)) {
      continue;
    }
    const current = byMediaId.get(row.mediaId) ?? [];
    current.push({
      mediaId: row.mediaId,
      variant: row.variant,
      storageKey: row.storageKey,
      width: row.width,
      height: row.height,
      byteSize: row.byteSize,
    });
    byMediaId.set(row.mediaId, current);
  }

  return byMediaId;
}

export function resolveStoredRenditions(
  mediaPublicBaseUrl: string | undefined,
  renditions: readonly StoredMediaRendition[] | undefined,
): ResolvedMediaRendition[] {
  if (!renditions || renditions.length === 0) {
    return [];
  }
  const resolved: ResolvedMediaRendition[] = [];
  for (const rendition of renditions) {
    const url = resolvePublicMediaUrl(mediaPublicBaseUrl, rendition.storageKey);
    if (!url) {
      continue;
    }
    resolved.push({
      variant: rendition.variant,
      url,
      width: rendition.width,
      height: rendition.height,
    });
  }
  return resolved;
}

export function resolvePublicImageDelivery(input: {
  mediaPublicBaseUrl: string | undefined;
  originalStorageKey: string;
  originalWidth: number | null;
  originalHeight: number | null;
  renditions?: readonly StoredMediaRendition[];
  surface: MediaRenditionSurface;
}): PublicImageDelivery {
  const originalUrl = resolvePublicMediaUrl(
    input.mediaPublicBaseUrl,
    input.originalStorageKey,
  );
  const resolved = resolveStoredRenditions(input.mediaPublicBaseUrl, input.renditions);
  const selected = selectResolvedImageDelivery({
    originalUrl,
    originalWidth: input.originalWidth,
    originalHeight: input.originalHeight,
    renditions: resolved,
    surface: input.surface,
  });
  const thumb = selectResolvedImageDelivery({
    originalUrl,
    originalWidth: input.originalWidth,
    originalHeight: input.originalHeight,
    renditions: resolved,
    surface: MEDIA_RENDITION_SURFACE.GALLERY_THUMB,
  });
  return {
    url: selected.url,
    width: selected.width,
    height: selected.height,
    srcSet: buildPublicImageSrcSet({
      originalUrl,
      originalWidth: input.originalWidth,
      renditions: resolved,
    }),
    thumbUrl: thumb.url,
  };
}
