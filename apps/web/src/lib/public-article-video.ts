import {
  VIDEO_PROVIDER,
  assertProviderVideoId,
  videoEmbedUrl,
  type PublicEditorialVideoProjection,
  type VideoProvider,
} from "@magazine/domain";

export const PUBLIC_VIDEO_PROVIDER_LABEL = {
  [VIDEO_PROVIDER.YOUTUBE]: "YouTube",
  [VIDEO_PROVIDER.VIMEO]: "Vimeo",
} as const;

export type TrustedPublicArticleVideo = {
  provider: VideoProvider;
  videoId: string;
  embedUrl: string;
  title: string;
  caption: string | null;
  providerLabel: string;
};

function isTrustedProvider(value: unknown): value is VideoProvider {
  return value === VIDEO_PROVIDER.YOUTUBE || value === VIDEO_PROVIDER.VIMEO;
}

function isExactTrustedEmbedUrl(input: {
  provider: VideoProvider;
  videoId: string;
  embedUrl: string;
}): boolean {
  const expected = videoEmbedUrl(input.provider, input.videoId);
  if (input.embedUrl !== expected) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(input.embedUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return false;
  }
  if (parsed.search !== "" || parsed.hash !== "") {
    return false;
  }

  if (input.provider === VIDEO_PROVIDER.YOUTUBE) {
    return (
      parsed.origin === "https://www.youtube-nocookie.com" &&
      parsed.pathname === `/embed/${input.videoId}`
    );
  }

  return (
    parsed.origin === "https://player.vimeo.com" &&
    parsed.pathname === `/video/${input.videoId}`
  );
}

export function toTrustedPublicArticleVideo(
  video: PublicEditorialVideoProjection | (PublicEditorialVideoProjection & Record<string, unknown>),
): TrustedPublicArticleVideo | null {
  if (!isTrustedProvider(video.provider) || typeof video.videoId !== "string") {
    return null;
  }

  const validated = assertProviderVideoId({
    provider: video.provider,
    providerVideoId: video.videoId,
  });
  if (!validated.ok) {
    return null;
  }

  if (
    typeof video.embedUrl !== "string" ||
    !isExactTrustedEmbedUrl({
      provider: video.provider,
      videoId: validated.value,
      embedUrl: video.embedUrl,
    })
  ) {
    return null;
  }

  const title = typeof video.title === "string" ? video.title.trim() : "";
  const caption =
    typeof video.caption === "string" && video.caption.trim().length > 0
      ? video.caption
      : null;
  const providerLabel = PUBLIC_VIDEO_PROVIDER_LABEL[video.provider];

  return {
    provider: video.provider,
    videoId: validated.value,
    embedUrl: videoEmbedUrl(video.provider, validated.value),
    title: title.length > 0 ? title : providerLabel,
    caption,
    providerLabel,
  };
}

/**
 * Public playback uses only the published projection list already resolved
 * through publishedVersionId. Extra editorial fields are dropped, not copied.
 */
export function trustedPublicArticleVideos(
  videos: readonly PublicEditorialVideoProjection[] | null | undefined,
): TrustedPublicArticleVideo[] {
  if (!Array.isArray(videos)) {
    return [];
  }

  const trusted: TrustedPublicArticleVideo[] = [];
  for (const video of videos) {
    const item = toTrustedPublicArticleVideo(video);
    if (item) {
      trusted.push(item);
    }
  }
  return trusted;
}
