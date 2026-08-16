import "server-only";

import { hash, verify } from "@node-rs/argon2";
import {
  ARGON2ID_ALGORITHM,
  ARGON2_MEMORY_COST_KIB,
  ARGON2_OUTPUT_LEN,
  ARGON2_PARALLELISM,
  ARGON2_TIME_COST,
} from "./password-params";

const ARGON2_OPTIONS = {
  algorithm: ARGON2ID_ALGORITHM,
  memoryCost: ARGON2_MEMORY_COST_KIB,
  timeCost: ARGON2_TIME_COST,
  parallelism: ARGON2_PARALLELISM,
  outputLen: ARGON2_OUTPUT_LEN,
};

/**
 * Precomputed Argon2id hash of a non-user dummy secret.
 * Used so unknown-email logins still perform KDF work.
 */
export const UNKNOWN_USER_DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$APBYLDWWrYt72Ztwi2thOA$2x1oyyM6Aykke8cm23bxZKCZkhghdM+fr7hGw2A+AbI";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password, ARGON2_OPTIONS);
}

export async function verifyUnknownUserPassword(
  password: string,
): Promise<boolean> {
  await verifyPassword(UNKNOWN_USER_DUMMY_HASH, password);
  return false;
}
