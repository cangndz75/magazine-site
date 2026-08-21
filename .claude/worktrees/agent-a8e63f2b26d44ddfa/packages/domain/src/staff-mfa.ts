import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { generateSecret, generateSync, generateURI, verifySync } from "otplib";

export const MFA_TOTP_STEP_SECONDS = 30;
export const MFA_TOTP_WINDOW = 1;
export const MFA_CHALLENGE_TTL_MS = 10 * 60 * 1000;
export const MFA_CHALLENGE_MAX_ATTEMPTS = 5;
export const MFA_RECOVERY_CODE_COUNT = 10;
export const MFA_RECOVERY_CODE_SEGMENT_LENGTH = 4;
export const MFA_RECOVERY_CODE_SEGMENTS = 2;

export const STAFF_MFA_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  MFA_NOT_ENROLLED: "MFA_NOT_ENROLLED",
  MFA_ALREADY_ACTIVE: "MFA_ALREADY_ACTIVE",
  MFA_ENROLLMENT_PENDING: "MFA_ENROLLMENT_PENDING",
  MFA_ENROLLMENT_NOT_PENDING: "MFA_ENROLLMENT_NOT_PENDING",
  INVALID_TOTP_CODE: "INVALID_TOTP_CODE",
  INVALID_RECOVERY_CODE: "INVALID_RECOVERY_CODE",
  CHALLENGE_NOT_FOUND: "CHALLENGE_NOT_FOUND",
  CHALLENGE_EXPIRED: "CHALLENGE_EXPIRED",
  CHALLENGE_CONSUMED: "CHALLENGE_CONSUMED",
  CHALLENGE_LOCKED: "CHALLENGE_LOCKED",
  TOTP_REPLAY: "TOTP_REPLAY",
  CRYPTO_ERROR: "CRYPTO_ERROR",
  STEP_UP_REQUIRED: "STEP_UP_REQUIRED",
} as const;

export type StaffMfaErrorCode =
  (typeof STAFF_MFA_ERROR)[keyof typeof STAFF_MFA_ERROR];

export class StaffMfaError extends Error {
  readonly code: StaffMfaErrorCode;

  constructor(code: StaffMfaErrorCode, message: string = code) {
    super(message);
    this.name = "StaffMfaError";
    this.code = code;
  }
}

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildTotpOtpauthUri(input: {
  issuer: string;
  accountName: string;
  secret: string;
}): string {
  return generateURI({
    issuer: input.issuer,
    label: input.accountName,
    secret: input.secret,
  });
}

export function generateTotpCodeAtTime(input: {
  secret: string;
  now: Date;
}): string {
  return generateSync({
    secret: input.secret,
    epoch: Math.floor(input.now.getTime() / 1000),
  });
}

export function normalizeTotpCode(raw: string): string | null {
  const digits = raw.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(digits)) {
    return null;
  }
  return digits;
}

export function totpStepForTime(now: Date): number {
  return Math.floor(now.getTime() / 1000 / MFA_TOTP_STEP_SECONDS);
}

export function verifyTotpCode(input: {
  secret: string;
  code: string;
  now: Date;
}): { valid: true; step: number } | { valid: false } {
  const normalized = normalizeTotpCode(input.code);
  if (!normalized) {
    return { valid: false };
  }

  const result = verifySync({
    token: normalized,
    secret: input.secret,
    epoch: Math.floor(input.now.getTime() / 1000),
    epochTolerance: MFA_TOTP_WINDOW * MFA_TOTP_STEP_SECONDS,
  });

  if (!result.valid) {
    return { valid: false };
  }

  return { valid: true, step: totpStepForTime(input.now) };
}

export function decideTotpReplay(input: {
  candidateStep: number;
  lastVerifiedStep: number | null;
}): { ok: true } | { ok: false; code: typeof STAFF_MFA_ERROR.TOTP_REPLAY } {
  if (
    input.lastVerifiedStep !== null &&
    input.candidateStep <= input.lastVerifiedStep
  ) {
    return { ok: false, code: STAFF_MFA_ERROR.TOTP_REPLAY };
  }
  return { ok: true };
}

export function generateRecoveryCodes(count = MFA_RECOVERY_CODE_COUNT): string[] {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const codes: string[] = [];
  const seen = new Set<string>();

  while (codes.length < count) {
    const bytes = randomBytes(MFA_RECOVERY_CODE_SEGMENT_LENGTH * MFA_RECOVERY_CODE_SEGMENTS);
    let raw = "";
    for (let i = 0; i < bytes.length; i++) {
      raw += alphabet[bytes[i]! % alphabet.length];
    }
    const code = `${raw.slice(0, MFA_RECOVERY_CODE_SEGMENT_LENGTH)}-${raw.slice(MFA_RECOVERY_CODE_SEGMENT_LENGTH)}`;
    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }

  return codes;
}

export function normalizeRecoveryCode(raw: string): string | null {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, "");
  const pattern = new RegExp(
    `^[${"23456789ABCDEFGHJKLMNPQRSTUVWXYZ"}]{${MFA_RECOVERY_CODE_SEGMENT_LENGTH}}-?[${"23456789ABCDEFGHJKLMNPQRSTUVWXYZ"}]{${MFA_RECOVERY_CODE_SEGMENT_LENGTH}}$`,
  );
  if (!pattern.test(normalized)) {
    return null;
  }
  const compact = normalized.replace("-", "");
  return `${compact.slice(0, MFA_RECOVERY_CODE_SEGMENT_LENGTH)}-${compact.slice(MFA_RECOVERY_CODE_SEGMENT_LENGTH)}`;
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("base64url");
}

export function recoveryCodesMatch(storedHash: string, code: string): boolean {
  const candidate = hashRecoveryCode(code);
  const left = Buffer.from(storedHash, "utf8");
  const right = Buffer.from(candidate, "utf8");
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function decideMfaChallengeAttempt(input: {
  now: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  lockedAt: Date | null;
  failedAttemptCount: number;
}): { ok: true } | { ok: false; code: StaffMfaErrorCode } {
  if (input.consumedAt) {
    return { ok: false, code: STAFF_MFA_ERROR.CHALLENGE_CONSUMED };
  }
  if (input.lockedAt) {
    return { ok: false, code: STAFF_MFA_ERROR.CHALLENGE_LOCKED };
  }
  if (input.expiresAt.getTime() <= input.now.getTime()) {
    return { ok: false, code: STAFF_MFA_ERROR.CHALLENGE_EXPIRED };
  }
  if (input.failedAttemptCount >= MFA_CHALLENGE_MAX_ATTEMPTS) {
    return { ok: false, code: STAFF_MFA_ERROR.CHALLENGE_LOCKED };
  }
  return { ok: true };
}

export function nextMfaChallengeFailure(input: {
  failedAttemptCount: number;
  now: Date;
}): { failedAttemptCount: number; lockedAt: Date | null } {
  const failedAttemptCount = input.failedAttemptCount + 1;
  return {
    failedAttemptCount,
    lockedAt:
      failedAttemptCount >= MFA_CHALLENGE_MAX_ATTEMPTS ? input.now : null,
  };
}

export function mfaAuditOmitsSecrets(
  changeSet: Record<string, unknown> | null,
): boolean {
  if (!changeSet) {
    return true;
  }
  const forbidden = [
    "password",
    "passwordHash",
    "token",
    "tokenHash",
    "secret",
    "secretCiphertext",
    "recoveryCode",
    "recoveryCodes",
    "recoveryCodeHash",
    "otp",
    "totp",
    "code",
  ];
  for (const key of Object.keys(changeSet)) {
    if (forbidden.includes(key)) {
      return false;
    }
    const value = changeSet[key];
    if (typeof value === "object" && value !== null) {
      if (!mfaAuditOmitsSecrets(value as Record<string, unknown>)) {
        return false;
      }
    }
  }
  return true;
}
