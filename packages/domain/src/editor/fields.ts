import { CREDIBILITY_VALUES, type Credibility } from "../credibility";
import { PUBLISHING_ERROR, type PublishingDecision } from "../publishing/errors";

export function canonicalizeDraftTitle(raw: string): PublishingDecision<string> {
  const title = raw.trim();
  if (title.length === 0) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_TITLE };
  }

  return { ok: true, value: title };
}

export function optionalTrimmedText(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function assertOptionalHttpUrl(
  value: string | null,
): PublishingDecision<string | null> {
  if (value === null) {
    return { ok: true, value: null };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_URL };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_URL };
  }

  return { ok: true, value: parsed.toString() };
}

export function parseCredibility(
  value: unknown,
): PublishingDecision<Credibility | null> {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  if (
    typeof value === "string" &&
    (CREDIBILITY_VALUES as readonly string[]).includes(value)
  ) {
    return { ok: true, value: value as Credibility };
  }

  return { ok: false, code: PUBLISHING_ERROR.INVALID_RELATION };
}
