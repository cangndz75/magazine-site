import {
  SEARCH_QUERY_MAX_LENGTH,
  SEARCH_QUERY_MIN_LENGTH,
  type SearchFilter,
  type SearchQueryDecision,
} from "./types";

const WHITESPACE = /\s+/g;
const ILIKE_WILDCARDS = /[%_]/g;

export function normalizeSearchQuery(raw: string): SearchQueryDecision {
  const trimmed = raw.normalize("NFC").replace(WHITESPACE, " ").trim();
  if (trimmed.length === 0) {
    return { ok: false, code: "EMPTY" };
  }
  if (trimmed.length > SEARCH_QUERY_MAX_LENGTH) {
    return { ok: false, code: "TOO_LONG" };
  }
  const sanitized = trimmed.replace(ILIKE_WILDCARDS, "");
  if (sanitized.length < SEARCH_QUERY_MIN_LENGTH) {
    return { ok: false, code: "TOO_SHORT" };
  }
  return { ok: true, normalizedQuery: sanitized };
}

export function parseSearchFilter(raw: string | undefined | null): SearchFilter {
  switch (raw) {
    case "ARTICLE":
    case "GALLERY":
    case "ENTITY":
      return raw;
    default:
      return "ALL";
  }
}

export function clampSearchLimit(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw) || raw < 1) {
    return 20;
  }
  return Math.min(Math.floor(raw), 25);
}
