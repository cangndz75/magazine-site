import {
  MEDIA_UPLOAD_ERROR,
  parseMediaStorageKey,
  type MediaUploadDecision,
} from "./media-upload";

export const MEDIA_RENDITION_VARIANT = {
  THUMB: "thumb",
  MEDIUM: "medium",
  LARGE: "large",
} as const;

export type MediaRenditionVariant =
  (typeof MEDIA_RENDITION_VARIANT)[keyof typeof MEDIA_RENDITION_VARIANT];

export const MEDIA_RENDITION_VARIANTS = [
  MEDIA_RENDITION_VARIANT.THUMB,
  MEDIA_RENDITION_VARIANT.MEDIUM,
  MEDIA_RENDITION_VARIANT.LARGE,
] as const;

export const MEDIA_RENDITION_MAX_EDGE = {
  thumb: 320,
  medium: 768,
  large: 1280,
} as const;

export const MEDIA_RENDITION_SURFACE = {
  LIBRARY_CARD: "LIBRARY_CARD",
  LIBRARY_INSPECTOR: "LIBRARY_INSPECTOR",
  HOMEPAGE_THUMB: "HOMEPAGE_THUMB",
  HOMEPAGE_LEAD: "HOMEPAGE_LEAD",
  ARTICLE_HERO: "ARTICLE_HERO",
  GALLERY_STAGE: "GALLERY_STAGE",
  GALLERY_THUMB: "GALLERY_THUMB",
  VIDEO_POSTER: "VIDEO_POSTER",
} as const;

export type MediaRenditionSurface =
  (typeof MEDIA_RENDITION_SURFACE)[keyof typeof MEDIA_RENDITION_SURFACE];

export const MEDIA_RENDITION_SURFACE_PREFERENCE: Record<
  MediaRenditionSurface,
  readonly MediaRenditionVariant[]
> = {
  LIBRARY_CARD: [MEDIA_RENDITION_VARIANT.THUMB],
  LIBRARY_INSPECTOR: [MEDIA_RENDITION_VARIANT.MEDIUM, MEDIA_RENDITION_VARIANT.LARGE],
  HOMEPAGE_THUMB: [MEDIA_RENDITION_VARIANT.THUMB, MEDIA_RENDITION_VARIANT.MEDIUM],
  HOMEPAGE_LEAD: [MEDIA_RENDITION_VARIANT.MEDIUM, MEDIA_RENDITION_VARIANT.LARGE],
  ARTICLE_HERO: [MEDIA_RENDITION_VARIANT.LARGE],
  GALLERY_STAGE: [MEDIA_RENDITION_VARIANT.LARGE, MEDIA_RENDITION_VARIANT.MEDIUM],
  GALLERY_THUMB: [MEDIA_RENDITION_VARIANT.THUMB, MEDIA_RENDITION_VARIANT.MEDIUM],
  VIDEO_POSTER: [MEDIA_RENDITION_VARIANT.THUMB, MEDIA_RENDITION_VARIANT.MEDIUM],
};

export const PUBLIC_GALLERY_IMAGE_SIZES = "(min-width: 768px) 720px, 100vw";

export type MediaRenditionSize = {
  width: number;
  height: number;
};

export type ResolvedMediaRendition = {
  variant: MediaRenditionVariant;
  url: string;
  width: number;
  height: number;
};

export type SelectedImageDelivery = {
  url: string | null;
  width: number | null;
  height: number | null;
};

function isRenditionVariant(value: string): value is MediaRenditionVariant {
  return (MEDIA_RENDITION_VARIANTS as readonly string[]).includes(value);
}

export function isMediaRenditionVariant(value: string): value is MediaRenditionVariant {
  return isRenditionVariant(value);
}

export function generateMediaRenditionStorageKey(
  originalKey: string,
  variant: MediaRenditionVariant,
): MediaUploadDecision<string> {
  if (!isRenditionVariant(variant)) {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.INVALID_UPLOAD };
  }
  const parsed = parseMediaStorageKey(originalKey);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.value.variant !== null) {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.INVALID_UPLOAD };
  }
  return {
    ok: true,
    value: `uploads/${parsed.value.year}/${parsed.value.month}/${parsed.value.id}.${variant}.${parsed.value.extension}`,
  };
}

export function plannedMediaRenditionKeys(
  originalKey: string,
): MediaUploadDecision<readonly string[]> {
  const keys: string[] = [];
  for (const variant of MEDIA_RENDITION_VARIANTS) {
    const generated = generateMediaRenditionStorageKey(originalKey, variant);
    if (!generated.ok) {
      return generated;
    }
    keys.push(generated.value);
  }
  return { ok: true, value: keys };
}

/**
 * Fit the longest edge to maxEdge. Returns null when the source already fits,
 * so callers never upscale or duplicate the original.
 */
export function fitRenditionSize(
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number,
): MediaRenditionSize | null {
  if (
    !Number.isInteger(sourceWidth) ||
    !Number.isInteger(sourceHeight) ||
    !Number.isInteger(maxEdge) ||
    sourceWidth < 1 ||
    sourceHeight < 1 ||
    maxEdge < 1
  ) {
    return null;
  }
  const longest = Math.max(sourceWidth, sourceHeight);
  if (longest <= maxEdge) {
    return null;
  }
  const scale = maxEdge / longest;
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  if (width >= sourceWidth && height >= sourceHeight) {
    return null;
  }
  return { width, height };
}

export function plannedRenditionSizes(input: {
  width: number;
  height: number;
}): Partial<Record<MediaRenditionVariant, MediaRenditionSize>> {
  const planned: Partial<Record<MediaRenditionVariant, MediaRenditionSize>> = {};
  for (const variant of MEDIA_RENDITION_VARIANTS) {
    const size = fitRenditionSize(
      input.width,
      input.height,
      MEDIA_RENDITION_MAX_EDGE[variant],
    );
    if (size) {
      planned[variant] = size;
    }
  }
  return planned;
}

export function selectResolvedImageDelivery(input: {
  originalUrl: string | null;
  originalWidth: number | null;
  originalHeight: number | null;
  renditions: readonly ResolvedMediaRendition[];
  surface: MediaRenditionSurface;
}): SelectedImageDelivery {
  const originalUrl = input.originalUrl?.trim() || null;
  const byVariant = new Map<MediaRenditionVariant, ResolvedMediaRendition>();
  for (const rendition of input.renditions) {
    if (!rendition.url.trim()) {
      continue;
    }
    byVariant.set(rendition.variant, {
      ...rendition,
      url: rendition.url.trim(),
    });
  }
  for (const variant of MEDIA_RENDITION_SURFACE_PREFERENCE[input.surface]) {
    const match = byVariant.get(variant);
    if (match) {
      return {
        url: match.url,
        width: match.width,
        height: match.height,
      };
    }
  }
  return {
    url: originalUrl,
    width: input.originalWidth,
    height: input.originalHeight,
  };
}

export function publicMediaRenditionsFromResolved(
  renditions: readonly ResolvedMediaRendition[],
): Partial<Record<MediaRenditionVariant, Omit<ResolvedMediaRendition, "variant">>> {
  const projected: Partial<
    Record<MediaRenditionVariant, Omit<ResolvedMediaRendition, "variant">>
  > = {};
  for (const rendition of renditions) {
    const url = rendition.url.trim();
    if (!url) {
      continue;
    }
    projected[rendition.variant] = {
      url,
      width: rendition.width,
      height: rendition.height,
    };
  }
  return projected;
}

export function buildPublicImageSrcSet(input: {
  originalUrl: string | null;
  originalWidth: number | null;
  renditions: readonly ResolvedMediaRendition[];
}): string | null {
  const entries: Array<{ url: string; width: number }> = [];
  const seenWidths = new Set<number>();

  for (const variant of MEDIA_RENDITION_VARIANTS) {
    const match = input.renditions.find((item) => item.variant === variant);
    const url = match?.url.trim();
    if (!match || !url || seenWidths.has(match.width)) {
      continue;
    }
    seenWidths.add(match.width);
    entries.push({ url, width: match.width });
  }

  const originalUrl = input.originalUrl?.trim() || null;
  const originalWidth = input.originalWidth;
  if (
    originalUrl &&
    originalWidth !== null &&
    originalWidth > 0 &&
    !seenWidths.has(originalWidth)
  ) {
    const largestRenditionWidth = entries.at(-1)?.width ?? 0;
    if (originalWidth > largestRenditionWidth) {
      entries.push({ url: originalUrl, width: originalWidth });
    }
  }

  if (entries.length < 2) {
    return null;
  }

  return entries.map((entry) => `${entry.url} ${entry.width}w`).join(", ");
}

export function publicImageProjectionLeaksInternal(value: object): boolean {
  const serialized = JSON.stringify(value);
  return (
    serialized.includes('"storageKey"') ||
    serialized.includes('"storage_key"') ||
    serialized.includes('"bucket"') ||
    serialized.includes("accessKeyId") ||
    serialized.includes("secretAccessKey") ||
    serialized.includes('"licenseNote"') ||
    serialized.includes('"rightsNote"')
  );
}
