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

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password, ARGON2_OPTIONS);
}
