import { PUBLICATION_STATUSES, type PublicationStatus } from "../publication-status";
import { WORKFLOW_STATUSES, type WorkflowStatus } from "../workflow-status";

export const EDITOR_LIST_DEFAULT_LIMIT = 20;
export const EDITOR_LIST_MAX_LIMIT = 50;
export const EDITOR_LOOKUP_MAX_LIMIT = 30;
export const EDITOR_SEARCH_MAX_LENGTH = 200;
export const EDITOR_JSON_MAX_BYTES = 1024 * 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function clampEditorListLimit(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw)) {
    return EDITOR_LIST_DEFAULT_LIMIT;
  }

  if (raw < 1) {
    return EDITOR_LIST_DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(raw), EDITOR_LIST_MAX_LIMIT);
}

export function clampEditorLookupLimit(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw) || raw < 1) {
    return EDITOR_LOOKUP_MAX_LIMIT;
  }

  return Math.min(Math.floor(raw), EDITOR_LOOKUP_MAX_LIMIT);
}

export function sanitizeEditorSearch(raw: string | undefined): string | null {
  if (raw === undefined) {
    return null;
  }

  const trimmed = raw.trim().slice(0, EDITOR_SEARCH_MAX_LENGTH);
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.replace(/[%_]/g, "");
}

export type EditorListCursor = {
  updatedAt: string;
  id: string;
};

export function encodeEditorListCursor(input: {
  updatedAt: Date | string;
  id: string;
}): string {
  const updatedAt =
    input.updatedAt instanceof Date
      ? input.updatedAt.toISOString()
      : new Date(input.updatedAt).toISOString();

  return Buffer.from(JSON.stringify({ updatedAt, id: input.id }), "utf8").toString(
    "base64url",
  );
}

export function decodeEditorListCursor(
  raw: string | undefined,
): EditorListCursor | null {
  if (raw === undefined || raw.length === 0) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("updatedAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.id !== "string" ||
      !isUuid(parsed.id) ||
      Number.isNaN(new Date(parsed.updatedAt).getTime())
    ) {
      return null;
    }

    return { updatedAt: parsed.updatedAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function parsePublicationStatusFilter(
  raw: string | undefined,
): PublicationStatus | null | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if ((PUBLICATION_STATUSES as readonly string[]).includes(raw)) {
    return raw as PublicationStatus;
  }

  return null;
}

export function parseWorkflowStatusFilter(
  raw: string | undefined,
): WorkflowStatus | null | undefined {
  if (raw === undefined) {
    return undefined;
  }

  if ((WORKFLOW_STATUSES as readonly string[]).includes(raw)) {
    return raw as WorkflowStatus;
  }

  return null;
}

export type EditorRevisionHistoryCursor = {
  versionNumber: number;
  id: string;
};

export function encodeEditorRevisionCursor(input: {
  versionNumber: number;
  id: string;
}): string {
  return Buffer.from(
    JSON.stringify({ versionNumber: input.versionNumber, id: input.id }),
    "utf8",
  ).toString("base64url");
}

export function decodeEditorRevisionCursor(
  raw: string | undefined,
): EditorRevisionHistoryCursor | null {
  if (raw === undefined || raw.length === 0) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("versionNumber" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.versionNumber !== "number" ||
      !Number.isInteger(parsed.versionNumber) ||
      parsed.versionNumber < 1 ||
      typeof parsed.id !== "string" ||
      !isUuid(parsed.id)
    ) {
      return null;
    }

    return { versionNumber: parsed.versionNumber, id: parsed.id };
  } catch {
    return null;
  }
}

/**
 * Review-queue cursor for oldest-waiting first:
 * COALESCE(latest SUBMITTED event, version.createdAt) ASC, versionId ASC.
 */
export type EditorReviewQueueCursor = {
  submittedAt: string;
  id: string;
};

export function encodeEditorReviewQueueCursor(input: {
  submittedAt: Date | string;
  id: string;
}): string {
  const submittedAt =
    input.submittedAt instanceof Date
      ? input.submittedAt.toISOString()
      : new Date(input.submittedAt).toISOString();

  return Buffer.from(
    JSON.stringify({ submittedAt, id: input.id }),
    "utf8",
  ).toString("base64url");
}

export function decodeEditorReviewQueueCursor(
  raw: string | undefined,
): EditorReviewQueueCursor | null {
  if (raw === undefined || raw.length === 0) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("submittedAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.submittedAt !== "string" ||
      typeof parsed.id !== "string" ||
      !isUuid(parsed.id) ||
      Number.isNaN(new Date(parsed.submittedAt).getTime())
    ) {
      return null;
    }

    return { submittedAt: parsed.submittedAt, id: parsed.id };
  } catch {
    return null;
  }
}
