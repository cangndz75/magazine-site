import type { SearchCursor } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeSearchCursor(input: SearchCursor): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

export function decodeSearchCursor(raw: string | null | undefined): SearchCursor | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("publishedAt" in parsed) ||
      !("id" in parsed) ||
      !("kind" in parsed) ||
      typeof parsed.publishedAt !== "string" ||
      typeof parsed.id !== "string" ||
      typeof parsed.kind !== "string" ||
      !UUID_PATTERN.test(parsed.id) ||
      Number.isNaN(new Date(parsed.publishedAt).getTime())
    ) {
      return null;
    }
    return {
      publishedAt: parsed.publishedAt,
      id: parsed.id,
      kind: parsed.kind as SearchCursor["kind"],
    };
  } catch {
    return null;
  }
}
