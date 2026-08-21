import {
  VIDEO_PROVIDER,
  MEDIA_RENDITION_SURFACE,
  providerThumbnailUrl,
  type VideoProvider,
} from "@magazine/domain";
import { previewUrlForImageSurface } from "./media-projections";
import type { StoredMediaRendition } from "../media/image-delivery";

export const VIDEO_POSTER_SOURCE = {
  EDITORIAL: "EDITORIAL",
  PROVIDER: "PROVIDER",
  NONE: "NONE",
} as const;

export type VideoPosterSource =
  (typeof VIDEO_POSTER_SOURCE)[keyof typeof VIDEO_POSTER_SOURCE];

export type EditorVideoPosterProjection = {
  posterSource: VideoPosterSource;
  posterPreviewUrl: string | null;
  posterWidth: number | null;
  posterHeight: number | null;
};

export function isVideoProvider(value: string): value is VideoProvider {
  return value === VIDEO_PROVIDER.YOUTUBE || value === VIDEO_PROVIDER.VIMEO;
}

export function resolveEditorVideoPoster(input: {
  provider: string;
  providerVideoId: string;
  posterMediaId: string | null;
  posterRow: {
    storageKey: string;
    width: number | null;
    height: number | null;
    renditions?: readonly StoredMediaRendition[];
  } | null;
  mediaPublicBaseUrl: string | undefined;
}): EditorVideoPosterProjection {
  if (input.posterMediaId && input.posterRow) {
    const previewUrl = previewUrlForImageSurface({
      mediaPublicBaseUrl: input.mediaPublicBaseUrl,
      originalStorageKey: input.posterRow.storageKey,
      originalWidth: input.posterRow.width,
      originalHeight: input.posterRow.height,
      renditions: input.posterRow.renditions,
      surface: MEDIA_RENDITION_SURFACE.VIDEO_POSTER,
    });
    return {
      posterSource: VIDEO_POSTER_SOURCE.EDITORIAL,
      posterPreviewUrl: previewUrl,
      posterWidth: input.posterRow.width,
      posterHeight: input.posterRow.height,
    };
  }

  if (isVideoProvider(input.provider)) {
    const url = providerThumbnailUrl(input.provider, input.providerVideoId);
    if (url) {
      return {
        posterSource: VIDEO_POSTER_SOURCE.PROVIDER,
        posterPreviewUrl: url,
        posterWidth: null,
        posterHeight: null,
      };
    }
  }

  return {
    posterSource: VIDEO_POSTER_SOURCE.NONE,
    posterPreviewUrl: null,
    posterWidth: null,
    posterHeight: null,
  };
}
