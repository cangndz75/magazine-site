import "server-only";

import { STAFF_MFA_ERROR, StaffMfaError } from "@magazine/domain";
import { EditorHttpError } from "@/lib/content/http";

export function mapStaffMfaError(error: StaffMfaError): never {
  const statusMap: Record<string, number> = {
    [STAFF_MFA_ERROR.FORBIDDEN]: 403,
    [STAFF_MFA_ERROR.MFA_NOT_ENROLLED]: 409,
    [STAFF_MFA_ERROR.MFA_ALREADY_ACTIVE]: 409,
    [STAFF_MFA_ERROR.MFA_ENROLLMENT_PENDING]: 409,
    [STAFF_MFA_ERROR.MFA_ENROLLMENT_NOT_PENDING]: 409,
    [STAFF_MFA_ERROR.INVALID_TOTP_CODE]: 400,
    [STAFF_MFA_ERROR.INVALID_RECOVERY_CODE]: 400,
    [STAFF_MFA_ERROR.CHALLENGE_NOT_FOUND]: 404,
    [STAFF_MFA_ERROR.CHALLENGE_EXPIRED]: 410,
    [STAFF_MFA_ERROR.CHALLENGE_CONSUMED]: 409,
    [STAFF_MFA_ERROR.CHALLENGE_LOCKED]: 429,
    [STAFF_MFA_ERROR.TOTP_REPLAY]: 409,
    [STAFF_MFA_ERROR.CRYPTO_ERROR]: 500,
    [STAFF_MFA_ERROR.STEP_UP_REQUIRED]: 401,
  };

  throw new EditorHttpError(
    statusMap[error.code] ?? 400,
    error.code,
    "The MFA request could not be completed.",
  );
}

export function requireStepUpPassword(
  verified: boolean,
): asserts verified is true {
  if (!verified) {
    throw new EditorHttpError(
      401,
      STAFF_MFA_ERROR.STEP_UP_REQUIRED,
      "Recent password confirmation is required.",
    );
  }
}
