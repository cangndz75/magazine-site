import {
  ENTITY_KINDS,
  ENTITY_STATUSES,
  clampEditorListLimit,
  decodeEditorListCursor,
  sanitizeEditorSearch,
  type EntityKind,
  type EntityStatus,
} from "@magazine/domain";

export type EntityPageFilters = {
  search: string | null;
  kind?: EntityKind;
  status?: EntityStatus;
  missingPortrait?: boolean;
  limit: number;
  cursor: ReturnType<typeof decodeEditorListCursor>;
};

function parseEnumParam<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return undefined;
  }
  return allowed.includes(raw as T) ? (raw as T) : undefined;
}

function parseBooleanParam(
  value: string | string[] | undefined,
): boolean | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "1" || raw === "true") {
    return true;
  }
  if (raw === "0" || raw === "false") {
    return false;
  }
  return undefined;
}

export function parseEntityPageSearchParams(
  params: Record<string, string | string[] | undefined>,
): EntityPageFilters {
  const qRaw = Array.isArray(params.q) ? params.q[0] : params.q;
  const cursorRaw = Array.isArray(params.cursor) ? params.cursor[0] : params.cursor;
  const limitRaw = Array.isArray(params.limit) ? params.limit[0] : params.limit;

  return {
    search: sanitizeEditorSearch(qRaw),
    kind: parseEnumParam(params.kind, ENTITY_KINDS),
    status: parseEnumParam(params.status, ENTITY_STATUSES),
    missingPortrait: parseBooleanParam(params.missingPortrait),
    limit: clampEditorListLimit(limitRaw ? Number(limitRaw) : undefined),
    cursor: decodeEditorListCursor(cursorRaw),
  };
}
