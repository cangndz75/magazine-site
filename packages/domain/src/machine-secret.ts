import { createHash, timingSafeEqual } from "node:crypto";

export function extractBearerToken(authorization: string | null): string {
  if (!authorization?.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length);
}

export function machineSecretsEqual(
  provided: string,
  expected: string,
): boolean {
  const leftDigest = createHash("sha256").update(provided).digest();
  const rightDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function isBearerMachineAuthorized(
  authorization: string | null,
  expectedSecret: string,
): boolean {
  const token = extractBearerToken(authorization);
  return Boolean(token) && machineSecretsEqual(token, expectedSecret);
}
