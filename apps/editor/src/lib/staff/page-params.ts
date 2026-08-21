import {
  clampEditorListLimit,
  decodeEditorListCursor,
  encodeEditorListCursor,
  STAFF_ROLES,
  STAFF_SCOPE_MODES,
  STAFF_STATUSES,
  sanitizeEditorSearch,
  type EditorListCursor,
  type StaffRole,
  type StaffScopeMode,
  type StaffStatus,
} from "@magazine/domain";

export type StaffPageFilters = {
  limit: number;
  cursor: EditorListCursor | null;
  search: string | null;
  status?: StaffStatus;
  role?: StaffRole;
  scopeMode?: StaffScopeMode;
};

export function parseStaffPageSearchParams(
  params: Record<string, string | string[] | undefined>,
): StaffPageFilters {
  const limitRaw = typeof params.limit === "string" ? params.limit : undefined;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const cursorRaw = typeof params.cursor === "string" ? params.cursor : undefined;
  const cursor = decodeEditorListCursor(cursorRaw) ?? null;

  const qRaw = typeof params.q === "string" ? params.q : undefined;
  const search = sanitizeEditorSearch(qRaw);

  const statusRaw = typeof params.status === "string" ? params.status : undefined;
  const status = (STAFF_STATUSES as readonly string[]).includes(statusRaw ?? "")
    ? (statusRaw as StaffStatus)
    : undefined;

  const roleRaw = typeof params.role === "string" ? params.role : undefined;
  const role = (STAFF_ROLES as readonly string[]).includes(roleRaw ?? "")
    ? (roleRaw as StaffRole)
    : undefined;

  const scopeModeRaw =
    typeof params.scopeMode === "string" ? params.scopeMode : undefined;
  const scopeMode = (STAFF_SCOPE_MODES as readonly string[]).includes(
    scopeModeRaw ?? "",
  )
    ? (scopeModeRaw as StaffScopeMode)
    : undefined;

  return {
    limit: clampEditorListLimit(limit),
    cursor,
    search,
    status,
    role,
    scopeMode,
  };
}

export function staffListQueryString(filters: StaffPageFilters): string {
  const params = new URLSearchParams();
  if (filters.search) {
    params.set("q", filters.search);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.role) {
    params.set("role", filters.role);
  }
  if (filters.scopeMode) {
    params.set("scopeMode", filters.scopeMode);
  }
  if (filters.limit !== 20) {
    params.set("limit", String(filters.limit));
  }
  if (filters.cursor) {
    params.set(
      "cursor",
      encodeEditorListCursor({
        updatedAt: filters.cursor.updatedAt,
        id: filters.cursor.id,
      }),
    );
  }
  return params.toString();
}
