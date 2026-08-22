import { isUuid } from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";

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

export function parseRedirectRuleId(value: string): string {
  if (!isUuid(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value;
}

export function parseRedirectCreateBody(body: unknown): {
  sourcePath: string;
  targetPath: string;
  note: string | null;
} {
  const record = asRecord(body);
  const noteRaw = record.note;
  const note =
    typeof noteRaw === "string" && noteRaw.trim().length > 0
      ? noteRaw.trim().slice(0, 500)
      : null;
  return {
    sourcePath: requiredString(record, "sourcePath"),
    targetPath: requiredString(record, "targetPath"),
    note,
  };
}

export function parseRedirectUpdateBody(body: unknown): {
  sourcePath?: string;
  targetPath?: string;
  enabled?: boolean;
  note?: string | null;
  expectedUpdatedAt: string;
} {
  const record = asRecord(body);
  const expectedUpdatedAt = requiredExpectedUpdatedAt(record);
  const result: {
    sourcePath?: string;
    targetPath?: string;
    enabled?: boolean;
    note?: string | null;
    expectedUpdatedAt: string;
  } = { expectedUpdatedAt };

  if (typeof record.sourcePath === "string" && record.sourcePath.trim().length > 0) {
    result.sourcePath = record.sourcePath.trim();
  }
  if (typeof record.targetPath === "string" && record.targetPath.trim().length > 0) {
    result.targetPath = record.targetPath.trim();
  }
  if (typeof record.enabled === "boolean") {
    result.enabled = record.enabled;
  }
  if (record.note === null) {
    result.note = null;
  } else if (typeof record.note === "string") {
    result.note =
      record.note.trim().length > 0 ? record.note.trim().slice(0, 500) : null;
  }

  return result;
}

export function parseRedirectListQuery(url: URL): {
  search: string | null;
  enabled: boolean | null;
  cursor: string | null;
  limit: number;
} {
  const search = url.searchParams.get("search")?.trim() ?? null;
  const enabledParam = url.searchParams.get("enabled");
  let enabled: boolean | null = null;
  if (enabledParam === "true") {
    enabled = true;
  } else if (enabledParam === "false") {
    enabled = false;
  }
  const cursor = url.searchParams.get("cursor")?.trim() ?? null;
  const limitRaw = Number(url.searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(100, Math.floor(limitRaw)))
    : 25;
  return { search, enabled, cursor, limit };
}
