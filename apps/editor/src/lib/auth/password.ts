import "server-only";

import { verifyPassword } from "./password-core";
export { hashPassword, verifyPassword } from "./password-core";

/**
 * Precomputed Argon2id hash of a non-user dummy secret.
 * Used so unknown-email logins still perform KDF work.
 */
export const UNKNOWN_USER_DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$APBYLDWWrYt72Ztwi2thOA$2x1oyyM6Aykke8cm23bxZKCZkhghdM+fr7hGw2A+AbI";

export async function verifyUnknownUserPassword(
  password: string,
): Promise<boolean> {
  await verifyPassword(UNKNOWN_USER_DUMMY_HASH, password);
  return false;
}
