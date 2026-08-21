import {
  STAFF_ADMIN_ERROR,
  STAFF_ROLES,
  STAFF_SCOPE_MODES,
  STAFF_STATUSES,
  StaffAdminError,
  canonicalizeStaffRoles,
  canonicalizeStaffScope,
  canonicalizeStaffStatus,
  clampEditorListLimit,
  decodeEditorListCursor,
  isUuid,
  sanitizeEditorSearch,
  type StaffRole,
  type StaffScopeMode,
  type StaffStatus,
} from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value.trim();
}

function requiredExpectedUpdatedAt(record: Record<string, unknown>): string {
  const expectedUpdatedAt = requiredString(record, "expectedUpdatedAt");
  if (Number.isNaN(new Date(expectedUpdatedAt).getTime())) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return expectedUpdatedAt;
}

export function parseStaffUserId(value: string): string {
  if (!isUuid(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value;
}

export function parseStaffSessionId(value: string): string {
  return parseStaffUserId(value);
}

export type StaffListQuery = {
  search: string | null;
  status?: StaffStatus;
  role?: StaffRole;
  scopeMode?: StaffScopeMode;
  limit: number;
  cursor: ReturnType<typeof decodeEditorListCursor>;
};

export function parseStaffListQuery(url: URL): StaffListQuery {
  const statusRaw = url.searchParams.get("status") ?? undefined;
  if (
    statusRaw &&
    !(STAFF_STATUSES as readonly string[]).includes(statusRaw)
  ) {
    throw new StaffAdminError(STAFF_ADMIN_ERROR.INVALID_STATUS);
  }

  const roleRaw = url.searchParams.get("role") ?? undefined;
  if (roleRaw && !(STAFF_ROLES as readonly string[]).includes(roleRaw)) {
    throw new StaffAdminError(STAFF_ADMIN_ERROR.INVALID_ROLE);
  }

  const scopeModeRaw = url.searchParams.get("scopeMode") ?? undefined;
  if (
    scopeModeRaw &&
    !(STAFF_SCOPE_MODES as readonly string[]).includes(scopeModeRaw)
  ) {
    throw new StaffAdminError(STAFF_ADMIN_ERROR.INVALID_SCOPE);
  }

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

  return {
    search: sanitizeEditorSearch(
      url.searchParams.get("q") ?? url.searchParams.get("search") ?? undefined,
    ),
    status: statusRaw as StaffStatus | undefined,
    role: roleRaw as StaffRole | undefined,
    scopeMode: scopeModeRaw as StaffScopeMode | undefined,
    limit: clampEditorListLimit(limit),
    cursor,
  };
}

export function parseStaffStatusBody(body: unknown): {
  status: StaffStatus;
  expectedUpdatedAt: string;
} {
  const record = asRecord(body);
  const status = canonicalizeStaffStatus(requiredString(record, "status"));
  if (!status.ok) {
    throw new StaffAdminError(status.code);
  }
  return {
    status: status.value,
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
  };
}

export function parseStaffRolesBody(body: unknown): {
  roles: StaffRole[];
  expectedUpdatedAt: string;
} {
  const record = asRecord(body);
  if (!Array.isArray(record.roles)) {
    throw new StaffAdminError(STAFF_ADMIN_ERROR.INVALID_ROLE);
  }
  if (record.roles.some((role) => typeof role !== "string")) {
    throw new StaffAdminError(STAFF_ADMIN_ERROR.INVALID_ROLE);
  }
  const roles = canonicalizeStaffRoles(record.roles);
  if (!roles.ok) {
    throw new StaffAdminError(roles.code);
  }
  return {
    roles: roles.value,
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
  };
}

export function parseStaffScopeBody(body: unknown): {
  scopeMode: StaffScopeMode;
  scopedCategoryIds: string[];
  expectedUpdatedAt: string;
} {
  const record = asRecord(body);
  const scopedCategoryIds = record.scopedCategoryIds;
  if (scopedCategoryIds !== undefined && !Array.isArray(scopedCategoryIds)) {
    throw new StaffAdminError(STAFF_ADMIN_ERROR.INVALID_SCOPE);
  }
  if (
    Array.isArray(scopedCategoryIds) &&
    scopedCategoryIds.some((id) => typeof id !== "string")
  ) {
    throw new StaffAdminError(STAFF_ADMIN_ERROR.INVALID_SCOPE);
  }
  const scope = canonicalizeStaffScope({
    scopeMode: requiredString(record, "scopeMode"),
    scopedCategoryIds: Array.isArray(scopedCategoryIds)
      ? scopedCategoryIds
      : [],
  });
  if (!scope.ok) {
    throw new StaffAdminError(scope.code);
  }
  return {
    ...scope.value,
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
  };
}

export function parseExpectedUpdatedAtBody(body: unknown): {
  expectedUpdatedAt: string;
} {
  return { expectedUpdatedAt: requiredExpectedUpdatedAt(asRecord(body)) };
}

export function parseRevokeAllSessionsBody(body: unknown): {
  includeCurrentSession: boolean;
} {
  const record = asRecord(body);
  if (
    record.includeCurrentSession !== undefined &&
    typeof record.includeCurrentSession !== "boolean"
  ) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return {
    includeCurrentSession: record.includeCurrentSession === true,
  };
}
