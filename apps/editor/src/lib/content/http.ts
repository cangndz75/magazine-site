import { NextResponse } from "next/server";
import {
  EDITOR_JSON_MAX_BYTES,
  HOMEPAGE_BUILDER_ERROR,
  HomepageBuilderError,
  PUBLISHING_ERROR,
  PublishingError,
  type HomepageBuilderErrorCode,
  type PublishingErrorCode,
} from "@magazine/domain";

export const EDITOR_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
} as const;

export const EDITOR_API_ERROR = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  CROSS_ORIGIN_REJECTED: "CROSS_ORIGIN_REJECTED",
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_JSON: "INVALID_JSON",
  REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export class EditorHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "EditorHttpError";
    this.status = status;
    this.code = code;
  }
}

const PUBLISHING_STATUS: Record<PublishingErrorCode, number> = {
  [PUBLISHING_ERROR.CONTENT_NOT_FOUND]: 404,
  [PUBLISHING_ERROR.VERSION_NOT_FOUND]: 404,
  [PUBLISHING_ERROR.CONTENT_DELETED]: 404,
  [PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM]: 400,
  [PUBLISHING_ERROR.INVALID_SLUG]: 400,
  [PUBLISHING_ERROR.SLUG_CONFLICT]: 409,
  [PUBLISHING_ERROR.DRAFT_ALREADY_EXISTS]: 409,
  [PUBLISHING_ERROR.NO_REVISION_SOURCE]: 409,
  [PUBLISHING_ERROR.INVALID_WORKFLOW_TRANSITION]: 409,
  [PUBLISHING_ERROR.VERSION_NOT_CURRENT_DRAFT]: 409,
  [PUBLISHING_ERROR.VERSION_NOT_APPROVED]: 409,
  [PUBLISHING_ERROR.VERSION_NOT_EDITABLE]: 409,
  [PUBLISHING_ERROR.INVALID_PUBLISH_TARGET]: 409,
  [PUBLISHING_ERROR.PUBLISH_READINESS_FAILED]: 422,
  [PUBLISHING_ERROR.NOT_PUBLISHED]: 409,
  [PUBLISHING_ERROR.ALREADY_SCHEDULED]: 409,
  [PUBLISHING_ERROR.NO_SCHEDULE]: 409,
  [PUBLISHING_ERROR.SCHEDULE_NOT_IN_FUTURE]: 422,
  [PUBLISHING_ERROR.CANNOT_SCHEDULE_PUBLISHED_VERSION]: 422,
  [PUBLISHING_ERROR.STALE_SCHEDULE_GENERATION]: 409,
  [PUBLISHING_ERROR.DUPLICATE_RELATION]: 400,
  [PUBLISHING_ERROR.MULTIPLE_PRIMARY_CATEGORIES]: 400,
  [PUBLISHING_ERROR.MULTIPLE_HERO_MEDIA]: 400,
  [PUBLISHING_ERROR.INVALID_RELATION]: 400,
  [PUBLISHING_ERROR.RELATION_NOT_FOUND]: 400,
  [PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT]: 409,
  [PUBLISHING_ERROR.INVALID_TITLE]: 400,
  [PUBLISHING_ERROR.INVALID_BODY]: 400,
  [PUBLISHING_ERROR.INVALID_URL]: 400,
  [PUBLISHING_ERROR.SELECTED_SCOPE_PRIMARY_REQUIRED]: 400,
  [PUBLISHING_ERROR.CATEGORY_OUT_OF_SCOPE]: 403,
  [PUBLISHING_ERROR.INVALID_REVIEW_NOTE]: 400,
  [PUBLISHING_ERROR.CONTENT_BODY_CORRUPT]: 422,
};

const HOMEPAGE_BUILDER_STATUS: Record<HomepageBuilderErrorCode, number> = {
  [HOMEPAGE_BUILDER_ERROR.FORBIDDEN]: 403,
  [HOMEPAGE_BUILDER_ERROR.INVALID_SLOT]: 400,
  [HOMEPAGE_BUILDER_ERROR.INVALID_CONTENT_ITEM]: 400,
  [HOMEPAGE_BUILDER_ERROR.DUPLICATE_CONTENT_ITEM]: 409,
  [HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT]: 409,
  [HOMEPAGE_BUILDER_ERROR.NO_DRAFT]: 409,
  [HOMEPAGE_BUILDER_ERROR.PUBLISH_VALIDATION_FAILED]: 422,
};

const SAFE_MESSAGES: Record<string, string> = {
  [EDITOR_API_ERROR.UNAUTHENTICATED]: "Authentication required.",
  [EDITOR_API_ERROR.FORBIDDEN]: "You are not allowed to perform this action.",
  [EDITOR_API_ERROR.CROSS_ORIGIN_REJECTED]: "Cross-origin request rejected.",
  [EDITOR_API_ERROR.INVALID_REQUEST]: "The request is invalid.",
  [EDITOR_API_ERROR.INVALID_JSON]: "The request body is not valid JSON.",
  [EDITOR_API_ERROR.REQUEST_TOO_LARGE]: "The request body is too large.",
  [EDITOR_API_ERROR.INTERNAL_ERROR]: "An unexpected error occurred.",
  [PUBLISHING_ERROR.CONTENT_NOT_FOUND]: "Content was not found.",
  [PUBLISHING_ERROR.VERSION_NOT_FOUND]: "Version was not found.",
  [PUBLISHING_ERROR.CONTENT_DELETED]: "Content was not found.",
  [PUBLISHING_ERROR.SLUG_CONFLICT]: "That slug is already in use.",
  [PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT]:
    "This draft was updated elsewhere. Reload and try again.",
  [PUBLISHING_ERROR.CATEGORY_OUT_OF_SCOPE]:
    "One or more categories are outside your assigned scope.",
  [PUBLISHING_ERROR.RELATION_NOT_FOUND]:
    "A selected category, tag, author, entity, or media record no longer exists.",
  [PUBLISHING_ERROR.DUPLICATE_RELATION]:
    "The same relation cannot be attached twice.",
  [PUBLISHING_ERROR.INVALID_RELATION]: "A relation in the request is invalid.",
  [PUBLISHING_ERROR.SELECTED_SCOPE_PRIMARY_REQUIRED]:
    "A primary category in your assigned scope is required.",
  [PUBLISHING_ERROR.INVALID_REVIEW_NOTE]:
    "Provide a plain-text review note between 3 and 4000 characters.",
  [PUBLISHING_ERROR.CONTENT_BODY_CORRUPT]:
    "Stored article body could not be compared.",
  [HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT]:
    "The homepage draft was updated elsewhere. Reload and try again.",
  [HOMEPAGE_BUILDER_ERROR.DUPLICATE_CONTENT_ITEM]:
    "The same story cannot occupy multiple homepage slots.",
  [HOMEPAGE_BUILDER_ERROR.INVALID_CONTENT_ITEM]:
    "The selected content item was not found.",
  [HOMEPAGE_BUILDER_ERROR.PUBLISH_VALIDATION_FAILED]:
    "The homepage draft cannot be published until all assignments are publicly eligible.",
};

export function editorJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: EDITOR_NO_STORE_HEADERS,
  });
}

export function editorErrorResponse(
  status: number,
  code: string,
  message?: string,
): NextResponse {
  return editorJson(
    {
      ok: false,
      error: {
        code,
        message: message ?? SAFE_MESSAGES[code] ?? "The request could not be completed.",
      },
    },
    status,
  );
}

export function mapEditorError(error: unknown): NextResponse {
  if (error instanceof EditorHttpError) {
    return editorErrorResponse(error.status, error.code, error.message);
  }

  if (error instanceof PublishingError) {
    return editorErrorResponse(
      PUBLISHING_STATUS[error.code] ?? 400,
      error.code,
      SAFE_MESSAGES[error.code],
    );
  }

  if (error instanceof HomepageBuilderError) {
    return editorErrorResponse(
      HOMEPAGE_BUILDER_STATUS[error.code] ?? 400,
      error.code,
      SAFE_MESSAGES[error.code],
    );
  }

  return editorErrorResponse(500, EDITOR_API_ERROR.INTERNAL_ERROR);
}

export async function readEditorJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > EDITOR_JSON_MAX_BYTES) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.REQUEST_TOO_LARGE,
      SAFE_MESSAGES[EDITOR_API_ERROR.REQUEST_TOO_LARGE],
    );
  }

  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_JSON,
      SAFE_MESSAGES[EDITOR_API_ERROR.INVALID_JSON],
    );
  }
}

export function editorOk<T>(data: T, status = 200): NextResponse {
  return editorJson({ ok: true, data }, status);
}
