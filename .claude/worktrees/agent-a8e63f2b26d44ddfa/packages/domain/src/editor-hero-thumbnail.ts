import { MEDIA_TYPE } from "./media-type";
import { PUBLICATION_STATUS, type PublicationStatus } from "./publication-status";

export type EditorSafeHeroThumbnail = {
  url: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  credit: string | null;
};

/**
 * Homepage Builder editor visualization only.
 * Published items use the public publishedVersionId HERO.
 * Unpublished / never-published items use the editor display version HERO.
 * Never persist this pointer; never send it to public homepage reads.
 */
export function selectEditorHomepageHeroVersionId(input: {
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  displayVersionId: string | null;
}): string | null {
  if (
    input.publicationStatus === PUBLICATION_STATUS.PUBLISHED &&
    input.publishedVersionId
  ) {
    return input.publishedVersionId;
  }

  return input.displayVersionId;
}

export function toEditorSafeHeroThumbnail(input: {
  mediaType: string;
  publicUrl: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  credit: string | null;
}): EditorSafeHeroThumbnail | null {
  if (input.mediaType !== MEDIA_TYPE.IMAGE) {
    return null;
  }

  const url = input.publicUrl?.trim() || null;
  if (!url) {
    return null;
  }

  return {
    url,
    width: input.width,
    height: input.height,
    altText: input.altText?.trim() || null,
    credit: input.credit?.trim() || null,
  };
}
