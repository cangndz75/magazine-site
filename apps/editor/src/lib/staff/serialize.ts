import {
  STAFF_SESSION_LIST_MAX,
  staffProjectionLeaksSensitiveMaterial,
  type SafeStaffAccountProjection,
  type SafeStaffSessionProjection,
} from "@magazine/domain";

function serializeDate(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function serializeRequiredDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export type StaffAccountListHttpDto = {
  id: string;
  email: string;
  displayName: string;
  status: SafeStaffAccountProjection["status"];
  scopeMode: SafeStaffAccountProjection["scopeMode"];
  roles: SafeStaffAccountProjection["roles"];
  capabilities: SafeStaffAccountProjection["capabilities"];
  scopedCategoryIds: string[];
  mfa: {
    enrolled: boolean;
    factorKind: SafeStaffAccountProjection["mfa"]["factorKind"];
    status: SafeStaffAccountProjection["mfa"]["status"];
  };
  passwordResetRequired: boolean;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
};

export type StaffAccountDetailHttpDto = StaffAccountListHttpDto & {
  passwordChangedAt: string | null;
  mfa: {
    enrolled: boolean;
    factorKind: SafeStaffAccountProjection["mfa"]["factorKind"];
    status: SafeStaffAccountProjection["mfa"]["status"];
    confirmedAt: string | null;
    disabledAt: string | null;
    unusedRecoveryCodeCount: number;
  };
};

export type StaffSessionHttpDto = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  state: SafeStaffSessionProjection["state"];
};

export function serializeStaffAccountListItem(
  account: SafeStaffAccountProjection,
): StaffAccountListHttpDto {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    status: account.status,
    scopeMode: account.scopeMode,
    roles: [...account.roles],
    capabilities: [...account.capabilities],
    scopedCategoryIds: [...account.scopedCategoryIds],
    mfa: {
      enrolled: account.mfa.enrolled,
      factorKind: account.mfa.factorKind,
      status: account.mfa.status,
    },
    passwordResetRequired: account.passwordResetRequired,
    createdAt: serializeRequiredDate(account.createdAt),
    updatedAt: serializeRequiredDate(account.updatedAt),
    disabledAt: serializeDate(account.disabledAt),
  };
}

export function serializeStaffAccountDetail(
  account: SafeStaffAccountProjection,
): StaffAccountDetailHttpDto {
  return {
    ...serializeStaffAccountListItem(account),
    passwordChangedAt: serializeDate(account.passwordChangedAt),
    mfa: {
      enrolled: account.mfa.enrolled,
      factorKind: account.mfa.factorKind,
      status: account.mfa.status,
      confirmedAt: serializeDate(account.mfa.confirmedAt),
      disabledAt: serializeDate(account.mfa.disabledAt),
      unusedRecoveryCodeCount: account.mfa.unusedRecoveryCodeCount,
    },
  };
}

export function serializeStaffSession(
  session: SafeStaffSessionProjection,
): StaffSessionHttpDto {
  return {
    id: session.id,
    createdAt: serializeRequiredDate(session.createdAt),
    lastSeenAt: serializeRequiredDate(session.lastSeenAt),
    expiresAt: serializeRequiredDate(session.expiresAt),
    revokedAt: serializeDate(session.revokedAt),
    state: session.state,
  };
}

export function serializeStaffSessionList(
  sessions: readonly SafeStaffSessionProjection[],
): { sessions: StaffSessionHttpDto[]; bound: number } {
  return {
    sessions: sessions.map(serializeStaffSession),
    bound: STAFF_SESSION_LIST_MAX,
  };
}

export function assertSafeStaffHttpPayload(value: unknown): void {
  if (staffProjectionLeaksSensitiveMaterial(value)) {
    throw new Error("Staff HTTP payload leaked sensitive material.");
  }
}
