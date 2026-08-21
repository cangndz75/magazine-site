import { ANALYTICS_ERROR, type AnalyticsErrorCode } from "./validation";

export const ANALYTICS_HTTP_ERROR = {
  INVALID_EVENT: "ANALYTICS_INVALID_EVENT",
  UNSUPPORTED_VERSION: "ANALYTICS_UNSUPPORTED_VERSION",
  EVENT_TOO_LARGE: "ANALYTICS_EVENT_TOO_LARGE",
  INVALID_TIMESTAMP: "ANALYTICS_INVALID_TIMESTAMP",
  INVALID_CONTEXT: "ANALYTICS_INVALID_CONTEXT",
  NOT_PUBLIC: "ANALYTICS_NOT_PUBLIC",
  RATE_LIMITED: "ANALYTICS_RATE_LIMITED",
  EVENT_ID_CONFLICT: "ANALYTICS_EVENT_ID_CONFLICT",
  ORIGIN_REJECTED: "ANALYTICS_ORIGIN_REJECTED",
  METHOD_NOT_ALLOWED: "ANALYTICS_METHOD_NOT_ALLOWED",
  UNSUPPORTED_MEDIA_TYPE: "ANALYTICS_UNSUPPORTED_MEDIA_TYPE",
  STORAGE_ERROR: "ANALYTICS_STORAGE_ERROR",
} as const;

export type AnalyticsHttpErrorCode =
  (typeof ANALYTICS_HTTP_ERROR)[keyof typeof ANALYTICS_HTTP_ERROR];

export const ANALYTICS_INGEST_STATUS = {
  ACCEPTED: "accepted",
  DEDUPLICATED: "deduplicated",
  CONFLICT: "conflict",
  REJECTED: "rejected",
} as const;

export type AnalyticsIngestStatus =
  (typeof ANALYTICS_INGEST_STATUS)[keyof typeof ANALYTICS_INGEST_STATUS];

export function mapAnalyticsErrorToHttp(code: AnalyticsErrorCode): {
  status: number;
  error: AnalyticsHttpErrorCode;
} {
  switch (code) {
    case ANALYTICS_ERROR.UNSUPPORTED_SCHEMA_VERSION:
    case ANALYTICS_ERROR.RETIRED_EVENT:
      return { status: 400, error: ANALYTICS_HTTP_ERROR.UNSUPPORTED_VERSION };
    case ANALYTICS_ERROR.EVENT_TOO_LARGE:
      return { status: 413, error: ANALYTICS_HTTP_ERROR.EVENT_TOO_LARGE };
    case ANALYTICS_ERROR.TIMESTAMP_OUT_OF_WINDOW:
      return { status: 400, error: ANALYTICS_HTTP_ERROR.INVALID_TIMESTAMP };
    case ANALYTICS_ERROR.INVALID_CONTEXT:
      return { status: 400, error: ANALYTICS_HTTP_ERROR.INVALID_CONTEXT };
    case ANALYTICS_ERROR.NOT_PUBLIC:
    case ANALYTICS_ERROR.ARTICLE_VIEW_NOT_AUTHORITATIVE:
      return { status: 400, error: ANALYTICS_HTTP_ERROR.NOT_PUBLIC };
    case ANALYTICS_ERROR.RATE_LIMITED:
      return { status: 429, error: ANALYTICS_HTTP_ERROR.RATE_LIMITED };
    case ANALYTICS_ERROR.EVENT_ID_CONFLICT:
      return { status: 409, error: ANALYTICS_HTTP_ERROR.EVENT_ID_CONFLICT };
    default:
      return { status: 400, error: ANALYTICS_HTTP_ERROR.INVALID_EVENT };
  }
}

export const ANALYTICS_ORIGIN_POLICY = {
  CSRF_TOKEN: false,
  REASON:
    "The endpoint writes anonymous facts and does not mutate authenticated state.",
  SAME_ORIGIN_WHEN_ORIGIN_PRESENT: true,
  MISSING_ORIGIN_ALLOWED_FOR_NON_BROWSER: true,
  CORS_CROSS_ORIGIN: false,
} as const;

export type AnalyticsOriginDecision =
  | { ok: true }
  | { ok: false; code: typeof ANALYTICS_HTTP_ERROR.ORIGIN_REJECTED };

export function decideAnalyticsRequestOrigin(input: {
  originHeader: string | null;
  refererHeader: string | null;
  secFetchSite: string | null;
  trustedSiteOrigin: string;
}): AnalyticsOriginDecision {
  const expected = originFromUrl(input.trustedSiteOrigin);
  if (expected === null) {
    return { ok: false, code: ANALYTICS_HTTP_ERROR.ORIGIN_REJECTED };
  }

  if (input.originHeader) {
    if (input.originHeader === "null" || input.originHeader !== expected) {
      return { ok: false, code: ANALYTICS_HTTP_ERROR.ORIGIN_REJECTED };
    }
    return { ok: true };
  }

  const fetchSite = input.secFetchSite?.toLowerCase() ?? "";
  if (fetchSite === "cross-site" || fetchSite === "cross-origin") {
    return { ok: false, code: ANALYTICS_HTTP_ERROR.ORIGIN_REJECTED };
  }

  if (input.refererHeader) {
    const refererOrigin = originFromUrl(input.refererHeader);
    if (refererOrigin === null || refererOrigin !== expected) {
      return { ok: false, code: ANALYTICS_HTTP_ERROR.ORIGIN_REJECTED };
    }
  }

  return { ok: true };
}

function originFromUrl(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isJsonContentType(contentType: string | null): boolean {
  if (contentType === null) {
    return false;
  }
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}
