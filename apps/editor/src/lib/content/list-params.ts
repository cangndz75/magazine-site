import {
  clampEditorListLimit,
  decodeEditorListCursor,
  decodeEditorReviewQueueCursor,
  decodeEditorRevisionCursor,
  isUuid,
  parsePublicationStatusFilter,
  parseWorkflowStatusFilter,
  sanitizeEditorSearch,
} from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "./http";

export function parseEditorListSearchParams(url: URL) {
  const limitRaw = url.searchParams.get("limit");
  const limit =
    limitRaw === null || limitRaw === ""
      ? undefined
      : Number.parseInt(limitRaw, 10);

  if (limitRaw !== null && limitRaw !== "" && Number.isNaN(limit)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const cursorRaw = url.searchParams.get("cursor") ?? undefined;
  const cursor = decodeEditorListCursor(cursorRaw);
  if (cursorRaw && !cursor) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const publicationStatus = parsePublicationStatusFilter(
    url.searchParams.get("publicationStatus") ?? undefined,
  );
  if (publicationStatus === null) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const workflowStatus = parseWorkflowStatusFilter(
    url.searchParams.get("workflowStatus") ?? undefined,
  );
  if (workflowStatus === null) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  if (categoryId && !isUuid(categoryId)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const authorId = url.searchParams.get("authorId") ?? undefined;
  if (authorId && !isUuid(authorId)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const scheduledRaw = url.searchParams.get("scheduledOnly");
  const scheduledOnly =
    scheduledRaw === "1" || scheduledRaw === "true"
      ? true
      : scheduledRaw === null || scheduledRaw === "" || scheduledRaw === "0" || scheduledRaw === "false"
        ? false
        : null;

  if (scheduledOnly === null) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return {
    limit: clampEditorListLimit(limit),
    cursor,
    search: sanitizeEditorSearch(url.searchParams.get("q") ?? undefined),
    publicationStatus,
    workflowStatus,
    categoryId,
    authorId,
    scheduledOnly,
  };
}

export function parseLookupSearchParams(url: URL) {
  const limitRaw = url.searchParams.get("limit");
  const limit =
    limitRaw === null || limitRaw === ""
      ? undefined
      : Number.parseInt(limitRaw, 10);

  if (limitRaw !== null && limitRaw !== "" && Number.isNaN(limit)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return {
    search: url.searchParams.get("q") ?? undefined,
    limit,
  };
}

export function parseContentItemId(value: string): string {
  if (!isUuid(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return value;
}

function parseLimitParam(url: URL): number {
  const limitRaw = url.searchParams.get("limit");
  const limit =
    limitRaw === null || limitRaw === ""
      ? undefined
      : Number.parseInt(limitRaw, 10);

  if (limitRaw !== null && limitRaw !== "" && Number.isNaN(limit)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return clampEditorListLimit(limit);
}

export function parseRevisionHistorySearchParams(url: URL) {
  const cursorRaw = url.searchParams.get("cursor") ?? undefined;
  const cursor = decodeEditorRevisionCursor(cursorRaw);
  if (cursorRaw && !cursor) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return {
    limit: parseLimitParam(url),
    cursor,
  };
}

export function parseDiffSearchParams(url: URL) {
  const fromVersionId = url.searchParams.get("fromVersionId") ?? "";
  const toVersionId = url.searchParams.get("toVersionId") ?? "";

  if (!isUuid(fromVersionId) || !isUuid(toVersionId)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return { fromVersionId, toVersionId };
}

export function parseReviewHistorySearchParams(url: URL) {
  const versionId = url.searchParams.get("versionId") ?? undefined;
  if (versionId && !isUuid(versionId)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return { versionId };
}

export function parseReviewQueueSearchParams(url: URL) {
  const cursorRaw = url.searchParams.get("cursor") ?? undefined;
  const cursor = decodeEditorReviewQueueCursor(cursorRaw);
  if (cursorRaw && !cursor) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const publicationStatus = parsePublicationStatusFilter(
    url.searchParams.get("publicationStatus") ?? undefined,
  );
  if (publicationStatus === null) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  if (categoryId && !isUuid(categoryId)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const authorId = url.searchParams.get("authorId") ?? undefined;
  if (authorId && !isUuid(authorId)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return {
    limit: parseLimitParam(url),
    cursor,
    search: sanitizeEditorSearch(url.searchParams.get("q") ?? undefined),
    publicationStatus,
    categoryId,
    authorId,
  };
}
