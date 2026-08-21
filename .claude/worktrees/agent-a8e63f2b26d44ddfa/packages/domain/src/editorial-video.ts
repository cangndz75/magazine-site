export const VIDEO_PROVIDER = {
  YOUTUBE: "YOUTUBE",
  VIMEO: "VIMEO",
} as const;

export type VideoProvider = (typeof VIDEO_PROVIDER)[keyof typeof VIDEO_PROVIDER];

export const VIDEO_PROVIDERS = [
  VIDEO_PROVIDER.YOUTUBE,
  VIDEO_PROVIDER.VIMEO,
] as const;

export const VIDEO_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  UNSUPPORTED_PROVIDER: "UNSUPPORTED_PROVIDER",
  INVALID_VIDEO_URL: "INVALID_VIDEO_URL",
  INVALID_PROVIDER_ID: "INVALID_PROVIDER_ID",
  DUPLICATE_VIDEO: "DUPLICATE_VIDEO",
  INVALID_POSTER: "INVALID_POSTER",
  INVALID_METADATA: "INVALID_METADATA",
  STALE_WRITE: "STALE_WRITE",
} as const;

export type VideoErrorCode = (typeof VIDEO_ERROR)[keyof typeof VIDEO_ERROR];

export class VideoError extends Error {
  readonly code: VideoErrorCode;

  constructor(code: VideoErrorCode, message: string = code) {
    super(message);
    this.name = "VideoError";
    this.code = code;
  }
}

export type VideoDecision<T> =
  | { ok: true; value: T }
  | { ok: false; code: VideoErrorCode };

export const VIDEO_TEXT_MAX = {
  TITLE: 200,
  CAPTION: 1000,
  DESCRIPTION: 4000,
  RIGHTS_NOTE: 4000,
  PROVENANCE: 1000,
} as const;

export const VIDEO_DURATION_SECONDS_MAX = 24 * 60 * 60;

export type CanonicalVideoIdentity = {
  provider: VideoProvider;
  providerVideoId: string;
  canonicalUrl: string;
  embedUrl: string;
  providerThumbnailUrl: string | null;
};

export type EditorialVideoWriteInput = {
  providerUrlOrId: string;
  title: string;
  caption?: string | null;
  description?: string | null;
  durationSeconds?: number | null;
  posterMediaId?: string | null;
  rightsNote?: string | null;
  provenance?: string | null;
};

export type CanonicalEditorialVideoWrite = CanonicalVideoIdentity & {
  title: string;
  caption: string | null;
  description: string | null;
  durationSeconds: number | null;
  posterMediaId: string | null;
  rightsNote: string | null;
  provenance: string | null;
  submittedUrl: string;
};

export type PublicEditorialVideoProjection = {
  provider: VideoProvider;
  videoId: string;
  embedUrl: string;
  canonicalUrl: string;
  title: string;
  caption: string | null;
  durationSeconds: number | null;
  /** Public editorial video identity. Playback does not require this field. */
  videoAssetId?: string;
  poster:
    | {
        url: string;
        width: number | null;
        height: number | null;
        altText: string | null;
        credit: string | null;
        source: "EDITORIAL";
      }
    | {
        url: string;
        width: null;
        height: null;
        altText: string | null;
        credit: null;
        source: "PROVIDER";
      }
    | null;
};

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID_RE = /^[0-9]{6,12}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

function canonicalizeBoundedText(
  raw: string | null | undefined,
  max: number,
  required: boolean,
): VideoDecision<string | null> {
  if (raw === undefined || raw === null) {
    return required
      ? { ok: false, code: VIDEO_ERROR.INVALID_METADATA }
      : { ok: true, value: null };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return required
      ? { ok: false, code: VIDEO_ERROR.INVALID_METADATA }
      : { ok: true, value: null };
  }
  if (trimmed.length > max) {
    return { ok: false, code: VIDEO_ERROR.INVALID_METADATA };
  }
  return { ok: true, value: trimmed };
}

export function assertVideoDurationSeconds(
  value: number | null | undefined,
): VideoDecision<number | null> {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (
    !Number.isInteger(value) ||
    value <= 0 ||
    value > VIDEO_DURATION_SECONDS_MAX
  ) {
    return { ok: false, code: VIDEO_ERROR.INVALID_METADATA };
  }
  return { ok: true, value };
}

export function videoCanonicalUrl(
  provider: VideoProvider,
  providerVideoId: string,
): string {
  return provider === VIDEO_PROVIDER.YOUTUBE
    ? `https://www.youtube.com/watch?v=${providerVideoId}`
    : `https://vimeo.com/${providerVideoId}`;
}

export function videoEmbedUrl(
  provider: VideoProvider,
  providerVideoId: string,
): string {
  return provider === VIDEO_PROVIDER.YOUTUBE
    ? `https://www.youtube-nocookie.com/embed/${providerVideoId}`
    : `https://player.vimeo.com/video/${providerVideoId}`;
}

export function providerThumbnailUrl(
  provider: VideoProvider,
  providerVideoId: string,
): string | null {
  return provider === VIDEO_PROVIDER.YOUTUBE
    ? `https://i.ytimg.com/vi/${providerVideoId}/hqdefault.jpg`
    : null;
}

export function assertProviderVideoId(input: {
  provider: VideoProvider;
  providerVideoId: string;
}): VideoDecision<string> {
  const trimmed = input.providerVideoId.trim();
  const valid =
    input.provider === VIDEO_PROVIDER.YOUTUBE
      ? YOUTUBE_ID_RE.test(trimmed)
      : VIMEO_ID_RE.test(trimmed);
  return valid
    ? { ok: true, value: trimmed }
    : { ok: false, code: VIDEO_ERROR.INVALID_PROVIDER_ID };
}

function parseYoutubeUrl(url: URL): VideoDecision<CanonicalVideoIdentity> {
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) {
    return { ok: false, code: VIDEO_ERROR.UNSUPPORTED_PROVIDER };
  }

  let id: string | null = null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (host === "youtu.be" || host === "www.youtu.be") {
    id = parts[0] ?? null;
  } else if (parts[0] === "watch") {
    id = url.searchParams.get("v");
  } else if (parts[0] === "shorts" || parts[0] === "embed") {
    id = parts[1] ?? null;
  }

  if (!id) {
    return { ok: false, code: VIDEO_ERROR.INVALID_VIDEO_URL };
  }
  const validated = assertProviderVideoId({
    provider: VIDEO_PROVIDER.YOUTUBE,
    providerVideoId: id,
  });
  if (!validated.ok) {
    return validated;
  }
  return {
    ok: true,
    value: buildVideoIdentity(VIDEO_PROVIDER.YOUTUBE, validated.value),
  };
}

function parseVimeoUrl(url: URL): VideoDecision<CanonicalVideoIdentity> {
  const host = url.hostname.toLowerCase();
  if (!VIMEO_HOSTS.has(host)) {
    return { ok: false, code: VIDEO_ERROR.UNSUPPORTED_PROVIDER };
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const id =
    host === "player.vimeo.com" && parts[0] === "video"
      ? parts[1]
      : parts.find((part) => VIMEO_ID_RE.test(part));
  if (!id) {
    return { ok: false, code: VIDEO_ERROR.INVALID_VIDEO_URL };
  }
  const validated = assertProviderVideoId({
    provider: VIDEO_PROVIDER.VIMEO,
    providerVideoId: id,
  });
  if (!validated.ok) {
    return validated;
  }
  return {
    ok: true,
    value: buildVideoIdentity(VIDEO_PROVIDER.VIMEO, validated.value),
  };
}

export function buildVideoIdentity(
  provider: VideoProvider,
  providerVideoId: string,
): CanonicalVideoIdentity {
  return {
    provider,
    providerVideoId,
    canonicalUrl: videoCanonicalUrl(provider, providerVideoId),
    embedUrl: videoEmbedUrl(provider, providerVideoId),
    providerThumbnailUrl: providerThumbnailUrl(provider, providerVideoId),
  };
}

export function parseVideoProviderInput(
  raw: string,
): VideoDecision<CanonicalVideoIdentity> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, code: VIDEO_ERROR.INVALID_VIDEO_URL };
  }

  if (YOUTUBE_ID_RE.test(trimmed)) {
    return {
      ok: true,
      value: buildVideoIdentity(VIDEO_PROVIDER.YOUTUBE, trimmed),
    };
  }
  if (VIMEO_ID_RE.test(trimmed)) {
    return {
      ok: true,
      value: buildVideoIdentity(VIDEO_PROVIDER.VIMEO, trimmed),
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, code: VIDEO_ERROR.INVALID_VIDEO_URL };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, code: VIDEO_ERROR.INVALID_VIDEO_URL };
  }

  const youtube = parseYoutubeUrl(url);
  if (youtube.ok || youtube.code !== VIDEO_ERROR.UNSUPPORTED_PROVIDER) {
    return youtube;
  }
  const vimeo = parseVimeoUrl(url);
  if (vimeo.ok || vimeo.code !== VIDEO_ERROR.UNSUPPORTED_PROVIDER) {
    return vimeo;
  }
  return { ok: false, code: VIDEO_ERROR.UNSUPPORTED_PROVIDER };
}

export function canonicalizeEditorialVideoWrite(
  input: EditorialVideoWriteInput,
): VideoDecision<CanonicalEditorialVideoWrite> {
  const identity = parseVideoProviderInput(input.providerUrlOrId);
  const title = canonicalizeBoundedText(
    input.title,
    VIDEO_TEXT_MAX.TITLE,
    true,
  );
  const caption = canonicalizeBoundedText(
    input.caption,
    VIDEO_TEXT_MAX.CAPTION,
    false,
  );
  const description = canonicalizeBoundedText(
    input.description,
    VIDEO_TEXT_MAX.DESCRIPTION,
    false,
  );
  const rightsNote = canonicalizeBoundedText(
    input.rightsNote,
    VIDEO_TEXT_MAX.RIGHTS_NOTE,
    false,
  );
  const provenance = canonicalizeBoundedText(
    input.provenance,
    VIDEO_TEXT_MAX.PROVENANCE,
    false,
  );
  const durationSeconds = assertVideoDurationSeconds(input.durationSeconds);

  if (!identity.ok) {
    return { ok: false, code: identity.code };
  }

  if (
    !title.ok ||
    !caption.ok ||
    !description.ok ||
    !rightsNote.ok ||
    !provenance.ok ||
    !durationSeconds.ok
  ) {
    return { ok: false, code: VIDEO_ERROR.INVALID_METADATA };
  }

  return {
    ok: true,
    value: {
      ...identity.value,
      title: title.value ?? "",
      caption: caption.value,
      description: description.value,
      durationSeconds: durationSeconds.value,
      posterMediaId: input.posterMediaId?.trim() || null,
      rightsNote: rightsNote.value,
      provenance: provenance.value,
      submittedUrl: input.providerUrlOrId.trim(),
    },
  };
}

export function toPublicEditorialVideoProjection(input: {
  provider: VideoProvider;
  providerVideoId: string;
  title: string;
  caption: string | null;
  durationSeconds: number | null;
  editorialPoster:
    | {
        publicUrl: string | null;
        width: number | null;
        height: number | null;
        altText: string | null;
        attachmentCredit: string | null;
        creditLine: string | null;
      }
    | null;
}): PublicEditorialVideoProjection | null {
  const validated = assertProviderVideoId({
    provider: input.provider,
    providerVideoId: input.providerVideoId,
  });
  if (!validated.ok) {
    return null;
  }
  const identity = buildVideoIdentity(input.provider, validated.value);
  const editorialPoster = input.editorialPoster;
  const poster =
    editorialPoster?.publicUrl !== null && editorialPoster?.publicUrl !== undefined
      ? {
          url: editorialPoster.publicUrl,
          width: editorialPoster.width,
          height: editorialPoster.height,
          altText: editorialPoster.altText,
          credit:
            editorialPoster.attachmentCredit?.trim() ||
            editorialPoster.creditLine?.trim() ||
            null,
          source: "EDITORIAL" as const,
        }
      : identity.providerThumbnailUrl
        ? {
            url: identity.providerThumbnailUrl,
            width: null,
            height: null,
            altText: input.title,
            credit: null,
            source: "PROVIDER" as const,
          }
        : null;

  return {
    provider: input.provider,
    videoId: validated.value,
    embedUrl: identity.embedUrl,
    canonicalUrl: identity.canonicalUrl,
    title: input.title,
    caption: input.caption,
    durationSeconds: input.durationSeconds,
    poster,
  };
}
