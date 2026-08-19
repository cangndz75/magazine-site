import { PUBLISHING_ERROR, type PublishingDecision } from "../publishing/errors";

function isJsonScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isJsonValue(value: unknown): boolean {
  if (isJsonScalar(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

/**
 * Body is structured JSONB application data, not an HTML/script execution path.
 * A stable CMS document schema is intentionally not invented here.
 */
export function assertStructuredArticleBody(
  body: unknown,
): PublishingDecision<Record<string, unknown> | unknown[]> {
  if (typeof body === "string" || typeof body === "number" || typeof body === "boolean") {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_BODY };
  }

  if (body === null || body === undefined) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_BODY };
  }

  if (!isJsonValue(body)) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_BODY };
  }

  if (Array.isArray(body) || (typeof body === "object" && body !== null)) {
    return { ok: true, value: body as Record<string, unknown> | unknown[] };
  }

  return { ok: false, code: PUBLISHING_ERROR.INVALID_BODY };
}
