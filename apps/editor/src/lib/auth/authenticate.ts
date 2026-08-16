import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@magazine/db/client";
import {
  staffPasswordCredentials,
  staffUsers,
} from "@magazine/db/schema";
import {
  decidePasswordCredentialTransition,
  assertPasswordPolicy,
  normalizeStaffEmail,
} from "@magazine/domain";
import {
  verifyPassword,
  verifyUnknownUserPassword,
} from "./password";
import { createStaffSession } from "./session";

export const LOGIN_FAILURE_CODE = {
  UNKNOWN_USER: "UNKNOWN_USER",
  WRONG_PASSWORD: "WRONG_PASSWORD",
  DISABLED: "DISABLED",
  LOCKED: "LOCKED",
  INVALID_INPUT: "INVALID_INPUT",
} as const;

export type LoginFailureCode =
  (typeof LOGIN_FAILURE_CODE)[keyof typeof LOGIN_FAILURE_CODE];

export type LoginResult =
  | { ok: true; token: string }
  | { ok: false; code: LoginFailureCode };

/**
 * Password KDF runs *before* the credential row lock so Argon2 does not
 * hold PostgreSQL row locks.
 *
 * Failed-attempt and successful-reset mutations then:
 *   BEGIN
 *   SELECT credential FOR UPDATE  -- serializes this staff credential row
 *   re-read user status
 *   decide transition from the locked current row
 *   UPDATE credential
 *   COMMIT
 *
 * Concurrent wrong passwords cannot lose increments: each mutation sees
 * the latest locked failedLoginCount. A success/fail race is ordered by
 * who acquires the row lock; success resets, failure increments from
 * whatever the locked row currently holds. Unknown emails have no row to
 * lock and never persist a counter.
 */
export async function authenticateStaffPassword(
  emailInput: string,
  password: string,
): Promise<LoginResult> {
  const email = normalizeStaffEmail(emailInput);
  const passwordPolicy = assertPasswordPolicy(password);

  if (!email || !passwordPolicy.ok) {
    await verifyUnknownUserPassword(password);
    return { ok: false, code: LOGIN_FAILURE_CODE.INVALID_INPUT };
  }

  const db = getDb();
  const [user] = await db
    .select({
      id: staffUsers.id,
    })
    .from(staffUsers)
    .where(eq(staffUsers.email, email))
    .limit(1);

  if (!user) {
    await verifyUnknownUserPassword(password);
    return { ok: false, code: LOGIN_FAILURE_CODE.UNKNOWN_USER };
  }

  const [credentials] = await db
    .select({
      passwordHash: staffPasswordCredentials.passwordHash,
    })
    .from(staffPasswordCredentials)
    .where(eq(staffPasswordCredentials.staffUserId, user.id))
    .limit(1);

  if (!credentials) {
    await verifyUnknownUserPassword(password);
    return { ok: false, code: LOGIN_FAILURE_CODE.UNKNOWN_USER };
  }

  const passwordMatches = await verifyPassword(
    credentials.passwordHash,
    password,
  );

  const txnResult = await db.transaction(async (tx) => {
    const [lockedCredentials] = await tx
      .select()
      .from(staffPasswordCredentials)
      .where(eq(staffPasswordCredentials.staffUserId, user.id))
      .for("update");

    const [freshUser] = await tx
      .select({ status: staffUsers.status })
      .from(staffUsers)
      .where(eq(staffUsers.id, user.id))
      .limit(1);

    if (!lockedCredentials) {
      return {
        ok: false as const,
        code: LOGIN_FAILURE_CODE.UNKNOWN_USER,
      };
    }

    if (lockedCredentials.passwordHash !== credentials.passwordHash) {
      return {
        ok: false as const,
        code: LOGIN_FAILURE_CODE.WRONG_PASSWORD,
      };
    }

    const decision = decidePasswordCredentialTransition({
      credentialFound: true,
      staffStatus: freshUser?.status ?? null,
      throttle: {
        failedLoginCount: lockedCredentials.failedLoginCount,
        lastFailedLoginAt: lockedCredentials.lastFailedLoginAt,
        lockedUntil: lockedCredentials.lockedUntil,
      },
      passwordMatches,
      now: new Date(),
    });

    if (decision.mutate === false) {
      return { ok: false as const, code: decision.code };
    }

    await tx
      .update(staffPasswordCredentials)
      .set({
        failedLoginCount: decision.next.failedLoginCount,
        lastFailedLoginAt: decision.next.lastFailedLoginAt,
        lockedUntil: decision.next.lockedUntil,
      })
      .where(eq(staffPasswordCredentials.staffUserId, user.id));

    if (decision.mutate === "reset") {
      return { ok: true as const };
    }

    return { ok: false as const, code: decision.code };
  });

  if (!txnResult.ok) {
    return txnResult;
  }

  const token = await createStaffSession(user.id);
  return { ok: true, token };
}
