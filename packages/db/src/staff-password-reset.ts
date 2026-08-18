import { and, eq, isNull, sql } from "drizzle-orm";
import {
  normalizeStaffEmail,
  STAFF_STATUS,
  type StaffRole,
} from "@magazine/domain";
import { getDb } from "./client";
import {
  staffPasswordCredentials,
  staffSessions,
  staffUserRoles,
  staffUsers,
} from "./schema";

/**
 * Parked/future MFA challenge tables. Rows are deleted when present;
 * missing tables are ignored so this stays safe before MFA migrations land.
 */
const STAFF_AUTH_CHALLENGE_TABLES = [
  "staff_login_challenges",
  "staff_mfa_challenges",
] as const;

export const STAFF_PASSWORD_RESET_ERROR = {
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_NOT_ACTIVE: "USER_NOT_ACTIVE",
  MISSING_CREDENTIAL: "MISSING_CREDENTIAL",
  INVALID_PASSWORD_HASH: "INVALID_PASSWORD_HASH",
} as const;

export type StaffPasswordResetErrorCode =
  (typeof STAFF_PASSWORD_RESET_ERROR)[keyof typeof STAFF_PASSWORD_RESET_ERROR];

export class StaffPasswordResetError extends Error {
  constructor(
    readonly code: StaffPasswordResetErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StaffPasswordResetError";
  }
}

export type StaffPasswordResetLookup = {
  staffUserId: string;
  email: string;
  roles: StaffRole[];
};

export type ResetStaffPasswordInput = {
  email: string;
  passwordHash: string;
};

export type ResetStaffPasswordResult = {
  staffUserId: string;
  email: string;
  revokedSessionCount: number;
  invalidatedChallengeCount: number;
};

export async function lookupActiveStaffAccountByEmail(
  emailInput: string,
): Promise<StaffPasswordResetLookup | null> {
  const email = normalizeResetEmail(emailInput);
  const db = getDb();

  const [user] = await db
    .select({
      id: staffUsers.id,
      email: staffUsers.email,
      status: staffUsers.status,
    })
    .from(staffUsers)
    .where(eq(staffUsers.email, email))
    .limit(1);

  if (!user) {
    return null;
  }

  if (user.status !== STAFF_STATUS.ACTIVE) {
    throw new StaffPasswordResetError(
      STAFF_PASSWORD_RESET_ERROR.USER_NOT_ACTIVE,
      "Staff account is not active.",
    );
  }

  const roles = await db
    .select({ role: staffUserRoles.role })
    .from(staffUserRoles)
    .where(eq(staffUserRoles.staffUserId, user.id));

  return {
    staffUserId: user.id,
    email: user.email,
    roles: roles.map((row) => row.role),
  };
}

export async function resetStaffPassword(
  input: ResetStaffPasswordInput,
): Promise<ResetStaffPasswordResult> {
  const email = normalizeResetEmail(input.email);
  const passwordHash = normalizeResetPasswordHash(input.passwordHash);
  const db = getDb();

  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        id: staffUsers.id,
        email: staffUsers.email,
        status: staffUsers.status,
      })
      .from(staffUsers)
      .where(eq(staffUsers.email, email))
      .limit(1);

    if (!user) {
      throw new StaffPasswordResetError(
        STAFF_PASSWORD_RESET_ERROR.USER_NOT_FOUND,
        "Staff account was not found.",
      );
    }

    if (user.status !== STAFF_STATUS.ACTIVE) {
      throw new StaffPasswordResetError(
        STAFF_PASSWORD_RESET_ERROR.USER_NOT_ACTIVE,
        "Staff account is not active.",
      );
    }

    const [credential] = await tx
      .select({ staffUserId: staffPasswordCredentials.staffUserId })
      .from(staffPasswordCredentials)
      .where(eq(staffPasswordCredentials.staffUserId, user.id))
      .limit(1);

    if (!credential) {
      throw new StaffPasswordResetError(
        STAFF_PASSWORD_RESET_ERROR.MISSING_CREDENTIAL,
        "Staff password credential was not found.",
      );
    }

    const now = new Date();

    await tx
      .update(staffPasswordCredentials)
      .set({
        passwordHash,
        passwordChangedAt: now,
        failedLoginCount: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
      })
      .where(eq(staffPasswordCredentials.staffUserId, user.id));

    const revokedSessions = await tx
      .update(staffSessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(staffSessions.staffUserId, user.id),
          isNull(staffSessions.revokedAt),
        ),
      )
      .returning({ id: staffSessions.id });

    const invalidatedChallengeCount = await invalidateOutstandingChallenges(
      tx,
      user.id,
    );

    return {
      staffUserId: user.id,
      email: user.email,
      revokedSessionCount: revokedSessions.length,
      invalidatedChallengeCount,
    };
  });
}

async function invalidateOutstandingChallenges(
  executor: { execute: ReturnType<typeof getDb>["execute"] },
  staffUserId: string,
): Promise<number> {
  let deleted = 0;

  for (const tableName of STAFF_AUTH_CHALLENGE_TABLES) {
    const existsResult = await executor.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ${tableName}
      ) AS exists
    `);

    const exists = existsResult.rows[0]?.exists === true;
    if (!exists) {
      continue;
    }

    const deleteResult = await executor.execute(
      sql`DELETE FROM ${sql.identifier(tableName)} WHERE staff_user_id = ${staffUserId}`,
    );
    deleted += deleteResult.rowCount ?? 0;
  }

  return deleted;
}

function normalizeResetEmail(input: string): string {
  const email = normalizeStaffEmail(input);
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new StaffPasswordResetError(
      STAFF_PASSWORD_RESET_ERROR.USER_NOT_FOUND,
      "Staff account was not found.",
    );
  }
  return email;
}

function normalizeResetPasswordHash(input: string): string {
  const passwordHash = input.trim();
  if (!passwordHash.startsWith("$argon2id$")) {
    throw new StaffPasswordResetError(
      STAFF_PASSWORD_RESET_ERROR.INVALID_PASSWORD_HASH,
      "Password hash is not a supported Argon2id hash.",
    );
  }
  return passwordHash;
}
