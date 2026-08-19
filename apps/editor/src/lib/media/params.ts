import {
  EDITOR_MEDIA_SORT,
  EDITOR_MEDIA_PAGE_SIZE_MAX,
  EDITOR_MEDIA_SEARCH_MAX,
  EDITOR_MEDIA_SORTS,
  parseEditorMediaPageSize,
  parseEditorMediaSearch,
  type EditorMediaSort,
} from "@magazine/db/editor";
import {
  MEDIA_RIGHTS_STATUS,
  MEDIA_TYPES,
  type MediaRightsStatus,
  type MediaType,
} from "@magazine/domain";

export type MediaLibraryQuery = {
  q?: string;
  type?: MediaType;
  rightsStatus?: MediaRightsStatus;
  missingCredit?: boolean;
  missingAltText?: boolean;
  used?: boolean;
  unused?: boolean;
  sort: EditorMediaSort;
  cursor?: string;
  pageSize: number;
};

export const DEFAULT_MEDIA_LIBRARY_QUERY: MediaLibraryQuery = {
  sort: EDITOR_MEDIA_SORT.CREATED_DESC,
  pageSize: parseEditorMediaPageSize(undefined),
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

export function parseMediaLibraryPageSearchParams(
  params: Record<string, string | string[] | undefined>,
): MediaLibraryQuery | { error: string } {
  const searchParams = new URLSearchParams();
  for (const key of [
    "q",
    "type",
    "rightsStatus",
    "missingCredit",
    "missingAltText",
    "used",
    "unused",
    "sort",
    "cursor",
    "pageSize",
  ]) {
    const value = pageParamValue(params, key);
    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }
  return parseMediaLibraryQuery(searchParams);
}

export function parseMediaLibrarySelectedId(
  params: Record<string, string | string[] | undefined>,
): string | null {
  const raw = pageParamValue(params, "selected");
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBool(value: string | null): boolean {
  return value === "1" || value === "true";
}

function parseMediaType(value: string | null): MediaType | undefined {
  if (!value) {
    return undefined;
  }
  return (MEDIA_TYPES as readonly string[]).includes(value)
    ? (value as MediaType)
    : undefined;
}

function parseRightsStatus(value: string | null): MediaRightsStatus | undefined {
  if (!value) {
    return undefined;
  }
  return (Object.values(MEDIA_RIGHTS_STATUS) as string[]).includes(value)
    ? (value as MediaRightsStatus)
    : undefined;
}

function parseSort(value: string | null): EditorMediaSort | undefined {
  if (!value) {
    return undefined;
  }
  return (EDITOR_MEDIA_SORTS as readonly string[]).includes(value)
    ? (value as EditorMediaSort)
    : undefined;
}

export function parseMediaLibraryQuery(
  searchParams: URLSearchParams,
): MediaLibraryQuery | { error: string } {
  const qRaw = searchParams.get("q");
  const q =
    qRaw === null
      ? undefined
      : parseEditorMediaSearch(qRaw) ?? undefined;
  if (qRaw !== null && qRaw.trim().length > EDITOR_MEDIA_SEARCH_MAX) {
    return { error: "Arama metni çok uzun." };
  }

  const pageSizeParam = searchParams.get("pageSize");
  const pageSize = parseEditorMediaPageSize(pageSizeParam ?? undefined);
  if (
    pageSizeParam !== null &&
    pageSizeParam.trim().length > 0 &&
    Number.parseInt(pageSizeParam, 10) > EDITOR_MEDIA_PAGE_SIZE_MAX
  ) {
    return { error: "Sayfa boyutu sınırı aşıldı." };
  }

  const sort = parseSort(searchParams.get("sort"));
  if (searchParams.get("sort") && !sort) {
    return { error: "Geçersiz sıralama." };
  }

  const type = parseMediaType(searchParams.get("type"));
  if (searchParams.get("type") && !type) {
    return { error: "Geçersiz medya türü." };
  }

  const rightsStatus = parseRightsStatus(searchParams.get("rightsStatus"));
  if (searchParams.get("rightsStatus") && !rightsStatus) {
    return { error: "Geçersiz hak durumu." };
  }

  return {
    q,
    type,
    rightsStatus,
    missingCredit: parseBool(searchParams.get("missingCredit")),
    missingAltText: parseBool(searchParams.get("missingAltText")),
    used: parseBool(searchParams.get("used")),
    unused: parseBool(searchParams.get("unused")),
    sort: sort ?? EDITOR_MEDIA_SORT.CREATED_DESC,
    cursor: searchParams.get("cursor") ?? undefined,
    pageSize,
  };
}
