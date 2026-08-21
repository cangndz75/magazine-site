import { effectiveCapabilities, hasCapability } from "./authorization";
import { CAPABILITY, type Capability } from "./capability";
import { assertExpectedUpdatedAt } from "./editor/concurrency";
import { isUuid } from "./editor/query-bounds";
import { STAFF_ROLE, STAFF_ROLES, type StaffRole } from "./staff-role";
import {
  STAFF_SCOPE_MODE,
  STAFF_SCOPE_MODES,
  type StaffScopeMode,
} from "./staff-scope-mode";
import { STAFF_STATUS, STAFF_STATUSES, type StaffStatus } from "./staff-status";

export const STAFF_ADMIN_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  STAFF_NOT_FOUND: "STAFF_NOT_FOUND",
  STAFF_WRITE_CONFLICT: "STAFF_WRITE_CONFLICT",
  LAST_SUPER_ADMIN: "LAST_SUPER_ADMIN",
  INVALID_ROLE: "INVALID_ROLE",
  INVALID_SCOPE: "INVALID_SCOPE",
  INVALID_STATUS: "INVALID_STATUS",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  MFA_NOT_ENROLLED: "MFA_NOT_ENROLLED",
} as const;

export type StaffAdminErrorCode =
  (typeof STAFF_ADMIN_ERROR)[keyof typeof STAFF_ADMIN_ERROR];

export class StaffAdminError extends Error {
  readonly code: StaffAdminErrorCode;

  constructor(code: StaffAdminErrorCode, message: string = code) {
    super(message);
    this.name = "StaffAdminError";
    this.code = code;
  }
}

export type StaffAdminDecision<T> =
  | { ok: true; value: T }
  | { ok: false; code: StaffAdminErrorCode };

export const STAFF_MFA_FACTOR_KIND = {
  TOTP: "TOTP",
} as const;

export type StaffMfaFactorKind =
  (typeof STAFF_MFA_FACTOR_KIND)[keyof typeof STAFF_MFA_FACTOR_KIND];

export const STAFF_MFA_FACTOR_KINDS = [STAFF_MFA_FACTOR_KIND.TOTP] as const;

export const STAFF_MFA_FACTOR_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
} as const;

export type StaffMfaFactorStatus =
  (typeof STAFF_MFA_FACTOR_STATUS)[keyof typeof STAFF_MFA_FACTOR_STATUS];

export const STAFF_MFA_FACTOR_STATUSES = [
  STAFF_MFA_FACTOR_STATUS.PENDING,
  STAFF_MFA_FACTOR_STATUS.ACTIVE,
  STAFF_MFA_FACTOR_STATUS.DISABLED,
] as const;

export const STAFF_SESSION_STATE = {
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
  EXPIRED: "EXPIRED",
} as const;

/**
 * Staff sessions are naturally few (one browser login at a time, plus
 * leftovers until expiry). The HTTP list is a hard safety bound, not a
 * paginated product surface.
 */
export const STAFF_SESSION_LIST_MAX = 50;

export type StaffSessionState =
  (typeof STAFF_SESSION_STATE)[keyof typeof STAFF_SESSION_STATE];

export const STAFF_SECURITY_AUDIT_EVENT_TYPE = {
  STAFF_SUSPENDED: "STAFF_SUSPENDED",
  STAFF_REACTIVATED: "STAFF_REACTIVATED",
  STAFF_ROLE_CHANGED: "STAFF_ROLE_CHANGED",
  STAFF_SCOPE_CHANGED: "STAFF_SCOPE_CHANGED",
  STAFF_SESSION_REVOKED: "STAFF_SESSION_REVOKED",
  STAFF_SESSIONS_REVOKED_ALL: "STAFF_SESSIONS_REVOKED_ALL",
  STAFF_MFA_DISABLED: "STAFF_MFA_DISABLED",
  STAFF_PASSWORD_RESET_REQUIRED: "STAFF_PASSWORD_RESET_REQUIRED",
  MFA_ENROLLMENT_STARTED: "MFA_ENROLLMENT_STARTED",
  MFA_ENABLED: "MFA_ENABLED",
  MFA_RECOVERY_CODES_REGENERATED: "MFA_RECOVERY_CODES_REGENERATED",
  MFA_RECOVERY_CODE_USED: "MFA_RECOVERY_CODE_USED",
  MFA_LOGIN_SUCCEEDED: "MFA_LOGIN_SUCCEEDED",
  MFA_CHALLENGE_LOCKED: "MFA_CHALLENGE_LOCKED",
} as const;

export type StaffSecurityAuditEventType =
  (typeof STAFF_SECURITY_AUDIT_EVENT_TYPE)[keyof typeof STAFF_SECURITY_AUDIT_EVENT_TYPE];

export const STAFF_SECURITY_AUDIT_EVENT_TYPES = [
  STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SUSPENDED,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_REACTIVATED,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_ROLE_CHANGED,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SCOPE_CHANGED,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SESSION_REVOKED,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SESSIONS_REVOKED_ALL,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_MFA_DISABLED,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_PASSWORD_RESET_REQUIRED,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_ENROLLMENT_STARTED,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_ENABLED,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_RECOVERY_CODES_REGENERATED,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_RECOVERY_CODE_USED,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_LOGIN_SUCCEEDED,
  STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_CHALLENGE_LOCKED,
] as const;

const FORBIDDEN_STAFF_PROJECTION_KEYS = new Set([
  "passwordHash",
  "password_hash",
  "tokenHash",
  "token_hash",
  "token",
  "secret",
  "secretCiphertext",
  "secret_ciphertext",
  "recoveryCode",
  "recoveryCodes",
  "recoveryCodeHash",
  "recovery_code_hash",
  "password",
]);

export type SafeStaffMfaProjection = {
  enrolled: boolean;
  factorKind: StaffMfaFactorKind | null;
  status: StaffMfaFactorStatus | "NONE";
  confirmedAt: Date | null;
  disabledAt: Date | null;
  unusedRecoveryCodeCount: number;
};

export type SafeStaffSessionProjection = {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  state: StaffSessionState;
};

export type SafeStaffAccountProjection = {
  id: string;
  email: string;
  displayName: string;
  status: StaffStatus;
  scopeMode: StaffScopeMode;
  roles: StaffRole[];
  capabilities: Capability[];
  scopedCategoryIds: string[];
  createdAt: Date;
  updatedAt: Date;
  disabledAt: Date | null;
  passwordChangedAt: Date | null;
  passwordResetRequired: boolean;
  failedLoginCount: number | null;
  lockedUntil: Date | null;
  mfa: SafeStaffMfaProjection;
};

export type StaffMfaFactorRecord = {
  kind: StaffMfaFactorKind;
  status: StaffMfaFactorStatus;
  confirmedAt: Date | null;
  disabledAt: Date | null;
  unusedRecoveryCodeCount: number;
};

export function authorizeStaffAdministration(input: {
  roles: readonly StaffRole[];
}): StaffAdminDecision<true> {
  if (!hasCapability(input.roles, CAPABILITY.STAFF_MANAGE)) {
    return { ok: false, code: STAFF_ADMIN_ERROR.FORBIDDEN };
  }
  return { ok: true, value: true };
}

export function presentStaffSessionState(input: {
  revokedAt: Date | string | null;
  expiresAt: Date | string;
  now: Date;
}): StaffSessionState {
  if (input.revokedAt) {
    return STAFF_SESSION_STATE.REVOKED;
  }
  const expiresAt = toDate(input.expiresAt);
  if (!expiresAt || expiresAt.getTime() <= input.now.getTime()) {
    return STAFF_SESSION_STATE.EXPIRED;
  }
  return STAFF_SESSION_STATE.ACTIVE;
}

export function toSafeStaffMfaProjection(
  factor: StaffMfaFactorRecord | null,
): SafeStaffMfaProjection {
  if (!factor) {
    return {
      enrolled: false,
      factorKind: null,
      status: "NONE",
      confirmedAt: null,
      disabledAt: null,
      unusedRecoveryCodeCount: 0,
    };
  }

  return {
    enrolled: factor.status === STAFF_MFA_FACTOR_STATUS.ACTIVE,
    factorKind: factor.kind,
    status: factor.status,
    confirmedAt: factor.confirmedAt,
    disabledAt: factor.disabledAt,
    unusedRecoveryCodeCount: Math.max(0, factor.unusedRecoveryCodeCount),
  };
}

export function toSafeStaffSessionProjection(input: {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  now: Date;
}): SafeStaffSessionProjection {
  return {
    id: input.id,
    createdAt: input.createdAt,
    lastSeenAt: input.lastSeenAt,
    expiresAt: input.expiresAt,
    revokedAt: input.revokedAt,
    state: presentStaffSessionState(input),
  };
}

export function toSafeStaffAccountProjection(input: {
  id: string;
  email: string;
  displayName: string;
  status: StaffStatus;
  scopeMode: StaffScopeMode;
  roles: readonly StaffRole[];
  scopedCategoryIds: readonly string[];
  createdAt: Date;
  updatedAt: Date;
  disabledAt: Date | null;
  passwordChangedAt: Date | null;
  passwordResetRequiredAt: Date | null;
  failedLoginCount: number | null;
  lockedUntil: Date | null;
  mfa: StaffMfaFactorRecord | null;
}): SafeStaffAccountProjection {
  return {
    id: input.id,
    email: input.email,
    displayName: input.displayName,
    status: input.status,
    scopeMode: input.scopeMode,
    roles: [...input.roles],
    capabilities: effectiveCapabilities(input.roles),
    scopedCategoryIds: [...input.scopedCategoryIds],
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    disabledAt: input.disabledAt,
    passwordChangedAt: input.passwordChangedAt,
    passwordResetRequired: input.passwordResetRequiredAt !== null,
    failedLoginCount: input.failedLoginCount,
    lockedUntil: input.lockedUntil,
    mfa: toSafeStaffMfaProjection(input.mfa),
  };
}

export function staffProjectionLeaksSensitiveMaterial(
  value: unknown,
): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(staffProjectionLeaksSensitiveMaterial);
  }

  if (typeof value !== "object") {
    return false;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_STAFF_PROJECTION_KEYS.has(key)) {
      return true;
    }
    if (staffProjectionLeaksSensitiveMaterial(nested)) {
      return true;
    }
  }

  return false;
}

export function canonicalizeStaffRoles(
  roles: readonly string[],
): StaffAdminDecision<StaffRole[]> {
  if (!Array.isArray(roles) || roles.length === 0) {
    return { ok: false, code: STAFF_ADMIN_ERROR.INVALID_ROLE };
  }

  const unique: StaffRole[] = [];
  for (const role of roles) {
    if (!STAFF_ROLES.includes(role as StaffRole)) {
      return { ok: false, code: STAFF_ADMIN_ERROR.INVALID_ROLE };
    }
    const staffRole = role as StaffRole;
    if (!unique.includes(staffRole)) {
      unique.push(staffRole);
    }
  }

  return { ok: true, value: unique };
}

export function canonicalizeStaffScope(input: {
  scopeMode: string;
  scopedCategoryIds: readonly string[];
}): StaffAdminDecision<{
  scopeMode: StaffScopeMode;
  scopedCategoryIds: string[];
}> {
  if (!STAFF_SCOPE_MODES.includes(input.scopeMode as StaffScopeMode)) {
    return { ok: false, code: STAFF_ADMIN_ERROR.INVALID_SCOPE };
  }

  const uniqueIds: string[] = [];
  for (const categoryId of input.scopedCategoryIds) {
    if (!isUuid(categoryId)) {
      return { ok: false, code: STAFF_ADMIN_ERROR.INVALID_SCOPE };
    }
    if (!uniqueIds.includes(categoryId)) {
      uniqueIds.push(categoryId);
    }
  }

  const scopeMode = input.scopeMode as StaffScopeMode;
  return {
    ok: true,
    value: {
      scopeMode,
      scopedCategoryIds:
        scopeMode === STAFF_SCOPE_MODE.ALL ? [] : uniqueIds,
    },
  };
}

export function canonicalizeStaffStatus(
  status: string,
): StaffAdminDecision<StaffStatus> {
  if (!STAFF_STATUSES.includes(status as StaffStatus)) {
    return { ok: false, code: STAFF_ADMIN_ERROR.INVALID_STATUS };
  }
  return { ok: true, value: status as StaffStatus };
}

export function targetIsViableSuperAdmin(input: {
  status: StaffStatus;
  roles: readonly StaffRole[];
}): boolean {
  return (
    input.status === STAFF_STATUS.ACTIVE &&
    input.roles.includes(STAFF_ROLE.SUPER_ADMIN)
  );
}

export function wouldRemoveLastSuperAdmin(input: {
  current: { status: StaffStatus; roles: readonly StaffRole[] };
  nextStatus: StaffStatus;
  nextRoles: readonly StaffRole[];
  viableSuperAdminCount: number;
}): boolean {
  if (!targetIsViableSuperAdmin(input.current)) {
    return false;
  }
  if (targetIsViableSuperAdmin({ status: input.nextStatus, roles: input.nextRoles })) {
    return false;
  }
  return input.viableSuperAdminCount <= 1;
}

export function decideStaffAccountStatusChange(input: {
  actorRoles: readonly StaffRole[];
  current: {
    status: StaffStatus;
    roles: readonly StaffRole[];
    updatedAt: Date | string;
  };
  nextStatus: string;
  expectedUpdatedAt: Date | string;
  viableSuperAdminCount: number;
}): StaffAdminDecision<{
  nextStatus: StaffStatus;
  disable: boolean;
  revokeAllSessions: boolean;
  auditEventType:
    | typeof STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SUSPENDED
    | typeof STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_REACTIVATED;
}> {
  const authorized = authorizeStaffAdministration({ roles: input.actorRoles });
  if (!authorized.ok) {
    return authorized;
  }

  const status = canonicalizeStaffStatus(input.nextStatus);
  if (!status.ok) {
    return status;
  }

  const concurrency = assertExpectedUpdatedAt({
    currentUpdatedAt: input.current.updatedAt,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (!concurrency.ok) {
    return { ok: false, code: STAFF_ADMIN_ERROR.STAFF_WRITE_CONFLICT };
  }

  if (
    wouldRemoveLastSuperAdmin({
      current: input.current,
      nextStatus: status.value,
      nextRoles: input.current.roles,
      viableSuperAdminCount: input.viableSuperAdminCount,
    })
  ) {
    return { ok: false, code: STAFF_ADMIN_ERROR.LAST_SUPER_ADMIN };
  }

  if (status.value === STAFF_STATUS.DISABLED) {
    return {
      ok: true,
      value: {
        nextStatus: STAFF_STATUS.DISABLED,
        disable: true,
        revokeAllSessions: true,
        auditEventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SUSPENDED,
      },
    };
  }

  return {
    ok: true,
    value: {
        nextStatus: STAFF_STATUS.ACTIVE,
        disable: false,
        revokeAllSessions: false,
      auditEventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_REACTIVATED,
    },
  };
}

export function decideStaffRoleChange(input: {
  actorRoles: readonly StaffRole[];
  current: {
    status: StaffStatus;
    roles: readonly StaffRole[];
    updatedAt: Date | string;
  };
  nextRoles: readonly string[];
  expectedUpdatedAt: Date | string;
  viableSuperAdminCount: number;
}): StaffAdminDecision<{ nextRoles: StaffRole[] }> {
  const authorized = authorizeStaffAdministration({ roles: input.actorRoles });
  if (!authorized.ok) {
    return authorized;
  }

  const roles = canonicalizeStaffRoles(input.nextRoles);
  if (!roles.ok) {
    return roles;
  }

  const concurrency = assertExpectedUpdatedAt({
    currentUpdatedAt: input.current.updatedAt,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (!concurrency.ok) {
    return { ok: false, code: STAFF_ADMIN_ERROR.STAFF_WRITE_CONFLICT };
  }

  if (
    wouldRemoveLastSuperAdmin({
      current: input.current,
      nextStatus: input.current.status,
      nextRoles: roles.value,
      viableSuperAdminCount: input.viableSuperAdminCount,
    })
  ) {
    return { ok: false, code: STAFF_ADMIN_ERROR.LAST_SUPER_ADMIN };
  }

  return { ok: true, value: { nextRoles: roles.value } };
}

export function decideStaffScopeChange(input: {
  actorRoles: readonly StaffRole[];
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
  scopeMode: string;
  scopedCategoryIds: readonly string[];
}): StaffAdminDecision<{
  scopeMode: StaffScopeMode;
  scopedCategoryIds: string[];
}> {
  const authorized = authorizeStaffAdministration({ roles: input.actorRoles });
  if (!authorized.ok) {
    return authorized;
  }

  const concurrency = assertExpectedUpdatedAt({
    currentUpdatedAt: input.currentUpdatedAt,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (!concurrency.ok) {
    return { ok: false, code: STAFF_ADMIN_ERROR.STAFF_WRITE_CONFLICT };
  }

  return canonicalizeStaffScope({
    scopeMode: input.scopeMode,
    scopedCategoryIds: input.scopedCategoryIds,
  });
}

export function decideStaffSessionRevoke(input: {
  actorRoles: readonly StaffRole[];
  sessionBelongsToTarget: boolean;
}): StaffAdminDecision<true> {
  const authorized = authorizeStaffAdministration({ roles: input.actorRoles });
  if (!authorized.ok) {
    return authorized;
  }
  if (!input.sessionBelongsToTarget) {
    return { ok: false, code: STAFF_ADMIN_ERROR.SESSION_NOT_FOUND };
  }
  return { ok: true, value: true };
}

export function decideRevokeAllStaffSessions(input: {
  actorRoles: readonly StaffRole[];
  actorStaffUserId: string;
  targetStaffUserId: string;
  currentSessionId: string | null;
}): StaffAdminDecision<{ preserveSessionId: string | null }> {
  const authorized = authorizeStaffAdministration({ roles: input.actorRoles });
  if (!authorized.ok) {
    return authorized;
  }

  const targetingSelf = input.actorStaffUserId === input.targetStaffUserId;
  return {
    ok: true,
    value: {
      preserveSessionId:
        targetingSelf && input.currentSessionId
          ? input.currentSessionId
          : null,
    },
  };
}

export function decideRequireStaffPasswordReset(input: {
  actorRoles: readonly StaffRole[];
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
}): StaffAdminDecision<true> {
  const authorized = authorizeStaffAdministration({ roles: input.actorRoles });
  if (!authorized.ok) {
    return authorized;
  }

  const concurrency = assertExpectedUpdatedAt({
    currentUpdatedAt: input.currentUpdatedAt,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (!concurrency.ok) {
    return { ok: false, code: STAFF_ADMIN_ERROR.STAFF_WRITE_CONFLICT };
  }

  return { ok: true, value: true };
}

export function decideDisableStaffMfa(input: {
  actorRoles: readonly StaffRole[];
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
  factorStatus: StaffMfaFactorStatus | null;
}): StaffAdminDecision<true> {
  const authorized = authorizeStaffAdministration({ roles: input.actorRoles });
  if (!authorized.ok) {
    return authorized;
  }

  const concurrency = assertExpectedUpdatedAt({
    currentUpdatedAt: input.currentUpdatedAt,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (!concurrency.ok) {
    return { ok: false, code: STAFF_ADMIN_ERROR.STAFF_WRITE_CONFLICT };
  }

  if (
    input.factorStatus !== STAFF_MFA_FACTOR_STATUS.ACTIVE &&
    input.factorStatus !== STAFF_MFA_FACTOR_STATUS.PENDING
  ) {
    return { ok: false, code: STAFF_ADMIN_ERROR.MFA_NOT_ENROLLED };
  }

  return { ok: true, value: true };
}

export function staffSecurityAuditOmitsSecrets(
  changeSet: Record<string, unknown> | null,
): boolean {
  return !staffProjectionLeaksSensitiveMaterial(changeSet);
}

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
