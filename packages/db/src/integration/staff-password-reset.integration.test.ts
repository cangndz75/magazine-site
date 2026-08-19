import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  STAFF_PASSWORD_RESET_ERROR,
  StaffPasswordResetError,
  resetStaffPassword,
} from "../staff-password-reset";
import { bootstrapInitialStaff } from "../staff-provisioning";
import {
  closeIntegrationConnections,
  ensureEditorContentTestDatabase,
  getRacerPool,
} from "./harness";
import {
  hashPassword,
  verifyPassword,
} from "../../../../apps/editor/src/lib/auth/password-core";

describe("staff password reset PostgreSQL integration", () => {
  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    await cleanupStaffAuthTables();
  });

  afterEach(async () => {
    await cleanupStaffAuthTables();
  });

  after(async () => {
    await closeIntegrationConnections();
  });

  it("updates credential, revokes sessions, and clears lockout counters", async () => {
    const initialPassword = "correct-horse-battery";
    const nextPassword = "another-correct-secret";
    const initialHash = await hashPassword(initialPassword);

    const created = await bootstrapInitialStaff({
      email: "reset.target@example.test",
      displayName: "Reset Target",
      passwordHash: initialHash,
    });

    const pool = getRacerPool();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await pool.query(
      `INSERT INTO staff_sessions (staff_user_id, token_hash, expires_at)
       VALUES ($1, 'session-token-hash-1', $2),
              ($1, 'session-token-hash-2', $2)`,
      [created.staffUserId, expiresAt],
    );
    await pool.query(
      `UPDATE staff_password_credentials
       SET failed_login_count = 3,
           locked_until = NOW() + interval '15 minutes'
       WHERE staff_user_id = $1`,
      [created.staffUserId],
    );

    const nextHash = await hashPassword(nextPassword);
    const result = await resetStaffPassword({
      email: created.email,
      passwordHash: nextHash,
    });

    assert.equal(result.email, "reset.target@example.test");
    assert.equal(result.revokedSessionCount, 2);
    assert.equal(result.invalidatedChallengeCount, 0);

    const credential = await pool.query<{
      password_hash: string;
      failed_login_count: number;
      locked_until: string | null;
    }>(
      `SELECT password_hash, failed_login_count, locked_until
       FROM staff_password_credentials
       WHERE staff_user_id = $1`,
      [created.staffUserId],
    );
    assert.equal(
      await verifyPassword(credential.rows[0]!.password_hash, nextPassword),
      true,
    );
    assert.equal(
      await verifyPassword(credential.rows[0]!.password_hash, initialPassword),
      false,
    );
    assert.equal(credential.rows[0]!.failed_login_count, 0);
    assert.equal(credential.rows[0]!.locked_until, null);

    const sessions = await pool.query<{ revoked_at: string | null }>(
      `SELECT revoked_at FROM staff_sessions WHERE staff_user_id = $1 ORDER BY token_hash`,
      [created.staffUserId],
    );
    assert.equal(sessions.rows.length, 2);
    assert.equal(sessions.rows.every((row) => row.revoked_at !== null), true);
  });

  it("fails closed when the staff account does not exist", async () => {
    const passwordHash = await hashPassword("correct-horse-battery");
    await assert.rejects(
      () =>
        resetStaffPassword({
          email: "missing.user@example.test",
          passwordHash,
        }),
      (error: unknown) =>
        error instanceof StaffPasswordResetError &&
        error.code === STAFF_PASSWORD_RESET_ERROR.USER_NOT_FOUND,
    );
  });

  it("does not create a second staff user", async () => {
    const passwordHash = await hashPassword("correct-horse-battery");
    await bootstrapInitialStaff({
      email: "only.user@example.test",
      displayName: "Only User",
      passwordHash,
    });

    const nextHash = await hashPassword("another-correct-secret");
    await resetStaffPassword({
      email: "only.user@example.test",
      passwordHash: nextHash,
    });

    const pool = getRacerPool();
    const users = await pool.query<{ email: string }>(
      "SELECT email FROM staff_users ORDER BY email",
    );
    assert.deepEqual(users.rows, [{ email: "only.user@example.test" }]);
  });

  it("invalidates outstanding login challenges when the table exists", async () => {
    const passwordHash = await hashPassword("correct-horse-battery");
    const created = await bootstrapInitialStaff({
      email: "challenge.user@example.test",
      displayName: "Challenge User",
      passwordHash,
    });

    const pool = getRacerPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff_login_challenges (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        staff_user_id uuid NOT NULL,
        token_hash text NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await pool.query(
      `INSERT INTO staff_login_challenges (staff_user_id, token_hash, expires_at)
       VALUES ($1, 'challenge-1', NOW() + interval '10 minutes'),
              ($1, 'challenge-2', NOW() + interval '10 minutes')`,
      [created.staffUserId],
    );

    const nextHash = await hashPassword("another-correct-secret");
    const result = await resetStaffPassword({
      email: created.email,
      passwordHash: nextHash,
    });

    assert.equal(result.invalidatedChallengeCount, 2);

    const remaining = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM staff_login_challenges
       WHERE staff_user_id = $1`,
      [created.staffUserId],
    );
    assert.equal(remaining.rows[0]?.count, "0");

    await pool.query("DROP TABLE IF EXISTS staff_login_challenges");
  });
});

async function cleanupStaffAuthTables(): Promise<void> {
  const pool = getRacerPool();
  await pool.query("DROP TABLE IF EXISTS staff_login_challenges");
  await pool.query("DROP TABLE IF EXISTS staff_mfa_challenges");
  await pool.query("DELETE FROM staff_sessions");
  await pool.query("DELETE FROM staff_user_category_scopes");
  await pool.query("DELETE FROM staff_user_roles");
  await pool.query("DELETE FROM staff_password_credentials");
  await pool.query("DELETE FROM staff_users");
}
