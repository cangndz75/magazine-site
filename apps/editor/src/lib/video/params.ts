import {
  EDITOR_VIDEO_PAGE_SIZE_MAX,
  EDITOR_VIDEO_SEARCH_MAX,
  parseEditorVideoPageSize,
  parseEditorVideoSearch,
} from "@magazine/db/editor";
import { VIDEO_PROVIDER, VIDEO_PROVIDERS, type VideoProvider } from "@magazine/domain";

export type VideoLibraryQuery = {
  q?: string;
  provider?: VideoProvider;
  poster?: "present" | "absent";
  used?: boolean;
  unused?: boolean;
  cursor?: string;
  pageSize: number;
};

export const DEFAULT_VIDEO_LIBRARY_QUERY: VideoLibraryQuery = {
  pageSize: parseEditorVideoPageSize(undefined),
};

function pageParamValue(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

function parseBool(value: string | null): boolean {
  return value === "1" || value === "true";
}

function parseProvider(value: string | null): VideoProvider | undefined {
  if (!value) {
    return undefined;
  }
  return (VIDEO_PROVIDERS as readonly string[]).includes(value)
    ? (value as VideoProvider)
    : undefined;
}

function parsePoster(value: string | null): "present" | "absent" | undefined {
  if (value === "present" || value === "absent") {
    return value;
  }
  return undefined;
}

export function parseVideoLibraryQuery(
  searchParams: URLSearchParams,
): VideoLibraryQuery | { error: string } {
  const qRaw = searchParams.get("q");
  const q =
    qRaw === null ? undefined : parseEditorVideoSearch(qRaw) ?? undefined;
  if (qRaw !== null && qRaw.trim().length > EDITOR_VIDEO_SEARCH_MAX) {
    return { error: "Arama metni çok uzun." };
  }

  const pageSizeParam = searchParams.get("pageSize");
  const pageSize = parseEditorVideoPageSize(pageSizeParam ?? undefined);
  if (
    pageSizeParam !== null &&
    pageSizeParam.trim().length > 0 &&
    Number.parseInt(pageSizeParam, 10) > EDITOR_VIDEO_PAGE_SIZE_MAX
  ) {
    return { error: "Sayfa boyutu sınırı aşıldı." };
  }

  const provider = parseProvider(searchParams.get("provider"));
  if (searchParams.get("provider") && !provider) {
    return { error: "Geçersiz sağlayıcı." };
  }

  const poster = parsePoster(searchParams.get("poster"));
  if (searchParams.get("poster") && !poster) {
    return { error: "Geçersiz poster filtresi." };
  }

  return {
    q,
    provider,
    poster,
    used: parseBool(searchParams.get("used")),
    unused: parseBool(searchParams.get("unused")),
    cursor: searchParams.get("cursor") ?? undefined,
    pageSize,
  };
}

export function parseVideoLibraryPageSearchParams(
  params: Record<string, string | string[] | undefined>,
): VideoLibraryQuery | { error: string } {
  const searchParams = new URLSearchParams();
  for (const key of ["q", "provider", "poster", "used", "unused", "cursor", "pageSize"]) {
    const value = pageParamValue(params, key);
    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }
  return parseVideoLibraryQuery(searchParams);
}

export function parseVideoLibrarySelectedId(
  params: Record<string, string | string[] | undefined>,
): string | null {
  const raw = pageParamValue(params, "selected");
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export { VIDEO_PROVIDER };
