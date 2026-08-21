import { STAFF_STATUS, type StaffStatus } from "./staff-status";

export const FAILED_LOGIN_LIMIT = 5;
export const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

export type LoginThrottleState = {
  failedLoginCount: number;
  lastFailedLoginAt: Date | null;
  lockedUntil: Date | null;
};

/**
 * Temporary lock is time-bounded. Consecutive-failure count is not.
 * An expired lockedUntil still leaves failedLoginCount in place; a later
 * wrong password at/above FAILED_LOGIN_LIMIT starts a new 15-minute lock.
 */
export function isPasswordAuthLocked(
  lockedUntil: Date | null,
  now: Date,
): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}

/**
 * Derives the next consecutive-failure state from the *current locked row*.
 * Callers must serialize mutations (PostgreSQL row lock) so this is not
 * applied to a stale failedLoginCount.
 *
 * Time expiry does not reset failedLoginCount. Only successful
 * authentication (resetLoginFailures) clears the consecutive-failure state.
 */
export function nextFailedLoginState(
  current: LoginThrottleState,
  now: Date,
): LoginThrottleState {
  const failedLoginCount = current.failedLoginCount + 1;
  const reachedThreshold = failedLoginCount >= FAILED_LOGIN_LIMIT;

  return {
    failedLoginCount,
    lastFailedLoginAt: now,
    lockedUntil: reachedThreshold
      ? new Date(now.getTime() + LOGIN_LOCK_DURATION_MS)
      : current.lockedUntil,
  };
}

export function resetLoginFailures(): LoginThrottleState {
  return {
    failedLoginCount: 0,
    lastFailedLoginAt: null,
    lockedUntil: null,
  };
}

export type PasswordCredentialDecision =
  | {
      mutate: false;
      code:
        | "UNKNOWN_USER"
        | "DISABLED"
        | "LOCKED"
        | "WRONG_PASSWORD"
        | "PASSWORD_RESET_REQUIRED";
    }
  | { mutate: "record-failure"; code: "WRONG_PASSWORD"; next: LoginThrottleState }
  | { mutate: "reset"; code: "SUCCESS"; next: LoginThrottleState };

/**
 * Pure credential-row state transition after FOR UPDATE.
 * Assumes mutations are applied in the same serialized transaction.
 * Does not prove PostgreSQL locking by itself.
 */
export function decidePasswordCredentialTransition(input: {
  credentialFound: boolean;
  staffStatus: StaffStatus | null;
  throttle: LoginThrottleState;
  passwordMatches: boolean;
  now: Date;
  passwordResetRequiredAt?: Date | string | null;
}): PasswordCredentialDecision {
  if (!input.credentialFound || input.staffStatus === null) {
    return { mutate: false, code: "UNKNOWN_USER" };
  }

  if (input.staffStatus === STAFF_STATUS.DISABLED) {
    return { mutate: false, code: "DISABLED" };
  }

  if (isPasswordAuthLocked(input.throttle.lockedUntil, input.now)) {
    return { mutate: false, code: "LOCKED" };
  }

  if (!input.passwordMatches) {
    return {
      mutate: "record-failure",
      code: "WRONG_PASSWORD",
      next: nextFailedLoginState(input.throttle, input.now),
    };
  }

  if (input.passwordResetRequiredAt) {
    return { mutate: false, code: "PASSWORD_RESET_REQUIRED" };
  }

  return {
    mutate: "reset",
    code: "SUCCESS",
    next: resetLoginFailures(),
  };
}
