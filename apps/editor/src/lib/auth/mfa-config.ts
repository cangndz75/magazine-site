import "server-only";

import { parseMfaEncryptionKey } from "@magazine/domain";
import { env } from "@/lib/env";

let cachedKey: Buffer | null = null;

export function getStaffMfaEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }
  const raw = env.STAFF_MFA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "STAFF_MFA_ENCRYPTION_KEY is not configured. MFA runtime is unavailable.",
    );
  }
  cachedKey = parseMfaEncryptionKey(raw);
  return cachedKey;
}

export function getStaffMfaTotpIssuer(): string {
  return env.STAFF_MFA_TOTP_ISSUER ?? "Magazine Editor";
}
