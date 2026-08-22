export type RedirectPageFilters = {
  search: string | null;
  enabled: boolean | null;
  cursor: string | null;
  limit: number;
};

export function parseRedirectPageSearchParams(
  params: Record<string, string | string[] | undefined>,
): RedirectPageFilters {
  const rawSearch = params.search;
  const search =
    typeof rawSearch === "string" && rawSearch.trim().length > 0
      ? rawSearch.trim()
      : null;
  const rawEnabled = params.enabled;
  let enabled: boolean | null = null;
  if (rawEnabled === "true") {
    enabled = true;
  } else if (rawEnabled === "false") {
    enabled = false;
  }
  const rawCursor = params.cursor;
  const cursor =
    typeof rawCursor === "string" && rawCursor.trim().length > 0
      ? rawCursor.trim()
      : null;
  const limitRaw = Number(
    typeof params.limit === "string" ? params.limit : "25",
  );
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(100, Math.floor(limitRaw)))
    : 25;
  return { search, enabled, cursor, limit };
}
