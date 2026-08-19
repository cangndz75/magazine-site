import { VIDEO_ERROR, VIDEO_PROVIDER, type VideoProvider } from "@magazine/domain";

export const VIDEO_PROVIDER_LABELS: Record<VideoProvider, string> = {
  [VIDEO_PROVIDER.YOUTUBE]: "YouTube",
  [VIDEO_PROVIDER.VIMEO]: "Vimeo",
};

export const VIDEO_POSTER_SOURCE_LABELS = {
  EDITORIAL: "Editoryal poster",
  PROVIDER: "Sağlayıcı küçük resmi",
  NONE: "Poster yok",
} as const;

export const VIDEO_LIBRARY_EMPTY = "Henüz video yok.";
export const VIDEO_LIBRARY_NO_RESULTS = "Arama veya filtrelerinize uygun video bulunamadı.";
export const ARTICLE_VIDEO_EMPTY = "Videodan içerik seç";
export const ARTICLE_VIDEO_REMOVE_NOTE =
  "Kaldırmak yalnızca bu taslaktaki ilişkiyi siler. Video kütüphanedeki varlık ve diğer haberler etkilenmez.";

export function videoProviderLabel(provider: string): string {
  if (provider === VIDEO_PROVIDER.YOUTUBE) {
    return VIDEO_PROVIDER_LABELS.YOUTUBE;
  }
  if (provider === VIDEO_PROVIDER.VIMEO) {
    return VIDEO_PROVIDER_LABELS.VIMEO;
  }
  return provider;
}

export function formatVideoDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds <= 0) {
    return "Süre yok";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function videoPosterFallbackLabel(input: {
  provider: string;
  posterSource?: string | null;
}): string {
  if (input.posterSource === "PROVIDER") {
    return `${videoProviderLabel(input.provider)} küçük resmi`;
  }
  if (input.provider === VIDEO_PROVIDER.VIMEO) {
    return "Vimeo posteri yok — editoryal görsel seçin";
  }
  return "Poster yok";
}

export function videoRightsSummary(input: {
  hasRightsNote: boolean;
  hasProvenance: boolean;
}): string {
  if (input.hasRightsNote && input.hasProvenance) {
    return "Kaynak ve hak notu var";
  }
  if (input.hasRightsNote) {
    return "Hak notu var";
  }
  if (input.hasProvenance) {
    return "Kaynak notu var";
  }
  return "Kaynak/hak notu yok";
}

function hostnameOf(raw: string): string | null {
  try {
    return new URL(raw.trim()).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function presentVideoUrlError(code: string, submittedUrl?: string): string {
  if (code === VIDEO_ERROR.UNSUPPORTED_PROVIDER) {
    return "Şu anda yalnızca YouTube ve Vimeo destekleniyor.";
  }
  if (code === VIDEO_ERROR.DUPLICATE_VIDEO) {
    return "Bu video zaten kayıtlı.";
  }
  if (code === VIDEO_ERROR.INVALID_PROVIDER_ID) {
    return "Video kimliği geçerli görünmüyor.";
  }
  if (code === VIDEO_ERROR.INVALID_VIDEO_URL) {
    const host = submittedUrl ? hostnameOf(submittedUrl) : null;
    if (host && (host.includes("youtube") || host === "youtu.be" || host.endsWith(".youtu.be"))) {
      return "Bu YouTube bağlantısı geçerli görünmüyor.";
    }
    if (host && host.includes("vimeo")) {
      return "Bu Vimeo bağlantısı geçerli görünmüyor.";
    }
    return "Video bağlantısı geçersiz.";
  }
  if (code === VIDEO_ERROR.INVALID_METADATA) {
    return "Video alanları geçersiz.";
  }
  if (code === VIDEO_ERROR.INVALID_POSTER) {
    return "Video posteri yalnızca görsel medya olabilir.";
  }
  if (code === VIDEO_ERROR.STALE_WRITE) {
    return "Bu video başka bir oturumda güncellendi. Yenileyip tekrar deneyin.";
  }
  if (code === VIDEO_ERROR.NOT_FOUND) {
    return "Video bulunamadı.";
  }
  if (code === VIDEO_ERROR.FORBIDDEN) {
    return "Bu işlem için yetkiniz yok.";
  }
  return "Video kaydedilemedi.";
}

export function toArticleVideoPutItems(
  videos: readonly {
    id: string;
    caption?: string | null;
  }[],
): { videoAssetId: string; caption: string | null }[] {
  return videos.map((item) => ({
    videoAssetId: item.id,
    caption: item.caption?.trim() ? item.caption.trim() : null,
  }));
}

export function isValidExpectedUpdatedAt(value: string | null | undefined): boolean {
  if (!value || value.trim().length === 0) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}
