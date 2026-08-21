import {
  ENTITY_KINDS,
  clampEditorLookupLimit,
  decodeEditorListCursor,
  isUuid,
  sanitizeEditorSearch,
  type EntityKind,
  type EntityProfileWriteInput,
  type EntityStatus,
} from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";
import { parseEntityPageSearchParams } from "./page-params";

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value.trim();
}

function optionalUuid(record: Record<string, unknown>, key: string): string | null {
  const value = optionalString(record, key);
  if (value === null) {
    return null;
  }
  if (!isUuid(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value;
}

function requiredExpectedUpdatedAt(record: Record<string, unknown>): string {
  const expectedUpdatedAt = requiredString(record, "expectedUpdatedAt");
  if (Number.isNaN(new Date(expectedUpdatedAt).getTime())) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return expectedUpdatedAt;
}

function parseKind(record: Record<string, unknown>): EntityKind {
  const kind = requiredString(record, "kind");
  if (!ENTITY_KINDS.includes(kind as EntityKind)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return kind as EntityKind;
}

function parseAliases(record: Record<string, unknown>): string[] {
  const value = record.aliases;
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value.map((item) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new EditorHttpError(
        400,
        EDITOR_API_ERROR.INVALID_REQUEST,
        "The request is invalid.",
      );
    }
    return item.trim();
  });
}

export function parseEntityId(value: string): string {
  if (!isUuid(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value;
}

export type EntityListQuery = {
  search: string | null;
  kind?: EntityKind;
  status?: EntityStatus;
  missingPortrait?: boolean;
  limit: number;
  cursor: ReturnType<typeof decodeEditorListCursor>;
};

export function parseEntityListQuery(url: URL): EntityListQuery {
  const filters = parseEntityPageSearchParams(Object.fromEntries(url.searchParams));
  return {
    search: filters.search,
    kind: filters.kind,
    status: filters.status,
    missingPortrait: filters.missingPortrait,
    limit: filters.limit,
    cursor: filters.cursor,
  };
}

export function parseEntityCreateBody(body: unknown): EntityProfileWriteInput {
  const record = asRecord(body);
  return {
    kind: parseKind(record),
    canonicalName: requiredString(record, "canonicalName"),
    slug: requiredString(record, "slug"),
    summary: optionalString(record, "summary"),
    biography: optionalString(record, "biography"),
    portraitMediaId: optionalUuid(record, "portraitMediaId"),
    birthDate: optionalString(record, "birthDate"),
    occupation: optionalString(record, "occupation"),
    officialWebsiteUrl: optionalString(record, "officialWebsiteUrl"),
    aliases: parseAliases(record),
  };
}

export function parseEntityUpdateBody(body: unknown): {
  expectedUpdatedAt: string;
  profile: EntityProfileWriteInput;
} {
  const record = asRecord(body);
  return {
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
    profile: {
      kind: parseKind(record),
      canonicalName: requiredString(record, "canonicalName"),
      slug: requiredString(record, "slug"),
      summary: optionalString(record, "summary"),
      biography: optionalString(record, "biography"),
      portraitMediaId: optionalUuid(record, "portraitMediaId"),
      birthDate: optionalString(record, "birthDate"),
      occupation: optionalString(record, "occupation"),
      officialWebsiteUrl: optionalString(record, "officialWebsiteUrl"),
      aliases: parseAliases(record),
    },
  };
}

export function parseEntityExpectedUpdatedAtBody(body: unknown): {
  expectedUpdatedAt: string;
} {
  const record = asRecord(body);
  return { expectedUpdatedAt: requiredExpectedUpdatedAt(record) };
}

export function parseEntitySlugBody(body: unknown): {
  expectedUpdatedAt: string;
  slug: string;
} {
  const record = asRecord(body);
  return {
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
    slug: requiredString(record, "slug"),
  };
}

export function parseEntityDuplicateQuery(url: URL): {
  canonicalName: string;
  aliases: string[];
  excludeEntityId?: string;
} {
  const canonicalName = sanitizeEditorSearch(url.searchParams.get("canonicalName") ?? "");
  if (!canonicalName) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  const aliasesRaw = url.searchParams.get("aliases");
  const aliases = aliasesRaw
    ? aliasesRaw.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
  const excludeEntityId = url.searchParams.get("excludeEntityId") ?? undefined;
  if (excludeEntityId && !isUuid(excludeEntityId)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return { canonicalName, aliases, excludeEntityId };
}

export function parseEntityLookupQuery(url: URL): {
  q: string | null;
  limit: number;
} {
  return {
    q: sanitizeEditorSearch(url.searchParams.get("q") ?? ""),
    limit: clampEditorLookupLimit(
      url.searchParams.get("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined,
    ),
  };
}
