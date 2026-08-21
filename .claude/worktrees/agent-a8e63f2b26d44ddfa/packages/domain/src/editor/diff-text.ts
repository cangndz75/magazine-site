const TOKEN_PATTERN = /\p{L}[\p{L}\p{M}\p{N}'’]*|\p{N}+|\s+|[^\s]/gu;

/**
 * Word/token split that keeps Unicode letters (including Turkish) intact
 * and does not split surrogate pairs.
 */
export function tokenizeEditorialText(text: string): string[] {
  return text.match(TOKEN_PATTERN) ?? [];
}

export function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const next: Record<string, unknown> = {};
    for (const key of keys) {
      next[key] = canonicalizeJson(record[key]);
    }
    return next;
  }

  return value;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}
