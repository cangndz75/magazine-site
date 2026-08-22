import { MEDIA_TYPE } from "./media-type";
import { PUBLISHING_ERROR, type PublishingDecision } from "./publishing/errors";
import { CONTENT_KIND, type ContentKind } from "./content-kind";
import {
  ARTICLE_HERO_ALT_TEXT_MAX,
  canonicalizeHeroAltText,
  canonicalizeHeroCredit,
} from "./article-hero";

export const ARTICLE_GALLERY_CAPTION_MAX = 500;
export const ARTICLE_GALLERY_MAX_ITEMS = 24;
export const ARTICLE_GALLERY_ALT_TEXT_MAX = ARTICLE_HERO_ALT_TEXT_MAX;

export type DraftGalleryItemInput = {
  mediaId: string;
  altText?: string | null;
  credit?: string | null;
  caption?: string | null;
};

export type CanonicalGalleryItem = {
  mediaId: string;
  sortOrder: number;
  altText: string | null;
  credit: string | null;
  caption: string | null;
};

export type PublicArticleGalleryItem = {
  mediaId: string;
  url: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  credit: string | null;
  thumbUrl: string;
  srcSet: string | null;
  sizes: string | null;
};

export type GalleryPublishReadinessInput = {
  contentKind: ContentKind;
  heroImageCount: number;
  galleryImageCount: number;
  blockedPublicMediaCount: number;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function canonicalizeGalleryCaption(
  value: string | null | undefined,
): PublishingDecision<string | null> {
  const trimmed = trimOrNull(value);
  if (trimmed !== null && trimmed.length > ARTICLE_GALLERY_CAPTION_MAX) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_RELATION };
  }
  return { ok: true, value: trimmed };
}

export function assertGalleryAssignableMediaType(
  mediaType: string,
): PublishingDecision<true> {
  if (mediaType !== MEDIA_TYPE.IMAGE) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_GALLERY_MEDIA };
  }
  return { ok: true, value: true };
}

export function canonicalizeDraftGalleryItems(
  items: readonly DraftGalleryItemInput[],
): PublishingDecision<CanonicalGalleryItem[]> {
  if (items.length > ARTICLE_GALLERY_MAX_ITEMS) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_RELATION };
  }

  const seen = new Set<string>();
  const canonical: CanonicalGalleryItem[] = [];

  for (const [index, item] of items.entries()) {
    const mediaId = item.mediaId.trim();
    if (!mediaId) {
      return { ok: false, code: PUBLISHING_ERROR.INVALID_RELATION };
    }
    if (seen.has(mediaId)) {
      return { ok: false, code: PUBLISHING_ERROR.DUPLICATE_RELATION };
    }
    seen.add(mediaId);

    const altText = canonicalizeHeroAltText(item.altText);
    if (!altText.ok) {
      return altText;
    }
    const credit = canonicalizeHeroCredit(item.credit);
    if (!credit.ok) {
      return credit;
    }
    const caption = canonicalizeGalleryCaption(item.caption);
    if (!caption.ok) {
      return caption;
    }

    canonical.push({
      mediaId,
      sortOrder: index,
      altText: altText.value,
      credit: credit.value,
      caption: caption.value,
    });
  }

  return { ok: true, value: canonical };
}

export function toPublicArticleGalleryItem(input: {
  mediaId: string;
  mediaType: string;
  publicUrl: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  attachmentCredit: string | null;
  creditLine: string | null;
  thumbUrl?: string | null;
  srcSet?: string | null;
  sizes?: string | null;
}): PublicArticleGalleryItem | null {
  if (input.mediaType !== MEDIA_TYPE.IMAGE) {
    return null;
  }

  const url = input.publicUrl?.trim() || null;
  if (!url) {
    return null;
  }

  const attachmentCredit = input.attachmentCredit?.trim() || null;
  const creditLine = input.creditLine?.trim() || null;
  const thumbUrl = input.thumbUrl?.trim() || url;
  const srcSet = input.srcSet?.trim() || null;
  const sizes = input.sizes?.trim() || null;

  return {
    mediaId: input.mediaId,
    url,
    width: input.width,
    height: input.height,
    altText: trimOrNull(input.altText),
    caption: trimOrNull(input.caption),
    credit: attachmentCredit ?? creditLine,
    thumbUrl,
    srcSet,
    sizes,
  };
}

export function assertGalleryPublishReadiness(
  input: GalleryPublishReadinessInput,
): PublishingDecision<true> {
  if (input.contentKind !== CONTENT_KIND.GALLERY) {
    return { ok: true, value: true };
  }

  if (
    input.heroImageCount !== 1 ||
    input.galleryImageCount < 1 ||
    input.blockedPublicMediaCount > 0
  ) {
    return { ok: false, code: PUBLISHING_ERROR.PUBLISH_READINESS_FAILED };
  }

  return { ok: true, value: true };
}
