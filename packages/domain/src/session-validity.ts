import { STAFF_STATUS, type StaffStatus } from "./staff-status";

export const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

export type SessionValidityInput = {
  revokedAt: Date | null;
  expiresAt: Date;
  now: Date;
  staffStatus: StaffStatus;
};

export type SessionInvalidReason = "revoked" | "expired" | "disabled";

export function evaluateStaffSession(
  input: SessionValidityInput,
): { ok: true } | { ok: false; reason: SessionInvalidReason } {
  if (input.revokedAt !== null) {
    return { ok: false, reason: "revoked" };
  }

  if (input.expiresAt.getTime() <= input.now.getTime()) {
    return { ok: false, reason: "expired" };
  }

  if (input.staffStatus === STAFF_STATUS.DISABLED) {
    return { ok: false, reason: "disabled" };
  }

  return { ok: true };
}
