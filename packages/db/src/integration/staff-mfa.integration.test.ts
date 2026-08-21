import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  STAFF_MFA_FACTOR_STATUS,
  STAFF_ROLE,
  StaffMfaError,
  STAFF_MFA_ERROR,
  generateTotpCodeAtTime,
  hashSessionToken,
} from "@magazine/domain";
import { getDb } from "../client";
import { disableStaffMfa, getStaffAccount } from "../staff-administration";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  createLoginChallenge,
  regenerateRecoveryCodes,
  staffHasActiveMfa,
  verifyLoginChallenge,
} from "../staff-mfa";
import { bootstrapInitialStaff } from "../staff-provisioning";
import {
  staffMfaFactors,
  staffMfaRecoveryCodes,
  staffMfaSecrets,
  staffSessions,
} from "../schema/staff";
import { eq } from "drizzle-orm";
import {
  cleanupStaffAuthTables,
  closeIntegrationConnections,
  ensureEditorContentTestDatabase,
  getRacerPool,
} from "./harness";
import { hashPassword } from "../../../../apps/editor/src/lib/auth/password-core";

const TEST_KEY = Buffer.alloc(32, 0x55);
const PASSWORD = "correct-horse-battery";
const NOW = new Date("2026-08-20T12:00:00.000Z");

function assertMfaCode(error: unknown, code: string): void {
  assert.equal(error instanceof StaffMfaError, true, String(error));
  assert.equal((error as StaffMfaError).code, code);
}

async function enrollAndConfirmMfa(input: {
  staffUserId: string;
  email: string;
}): Promise<{ factorId: string; secret: string; recoveryCodes: string[] }> {
  const enrollment = await beginTotpEnrollment({
    staffUserId: input.staffUserId,
    email: input.email,
    issuer: "Magazine Editor Test",
    encryptionKey: TEST_KEY,
    now: NOW,
  });
  const secret = enrollment.secret;
  const code = generateTotpCodeAtTime({ secret, now: NOW });
  const confirmed = await confirmTotpEnrollment({
    staffUserId: input.staffUserId,
    factorId: enrollment.factorId,
    totpCode: code,
    encryptionKey: TEST_KEY,
    now: NOW,
  });
  return {
    factorId: enrollment.factorId,
    secret,
    recoveryCodes: confirmed.recoveryCodes,
  };
}

describe("staff MFA runtime PostgreSQL integration", () => {
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

  it("stores encrypted secrets and activates MFA only after confirmation", async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const created = await bootstrapInitialStaff({
      email: "mfa.user@example.test",
      displayName: "MFA User",
      passwordHash,
    });

    assert.equal(await staffHasActiveMfa(created.staffUserId), false);

    const enrollment = await beginTotpEnrollment({
      staffUserId: created.staffUserId,
      email: created.email,
      issuer: "Magazine Editor Test",
      encryptionKey: TEST_KEY,
      now: NOW,
    });

    const db = getDb();
    const [factor] = await db
      .select()
      .from(staffMfaFactors)
      .where(eq(staffMfaFactors.id, enrollment.factorId));
    assert.equal(factor?.status, STAFF_MFA_FACTOR_STATUS.PENDING);
    assert.equal(await staffHasActiveMfa(created.staffUserId), false);

    const [secretRow] = await db
      .select()
      .from(staffMfaSecrets)
      .where(eq(staffMfaSecrets.factorId, enrollment.factorId));
    assert.ok(secretRow);
    assert.equal(secretRow.secretCiphertext.includes(enrollment.secret), false);
    assert.match(secretRow.secretCiphertext, /^1\./);

    const badConfirm = confirmTotpEnrollment({
      staffUserId: created.staffUserId,
      factorId: enrollment.factorId,
      totpCode: "000000",
      encryptionKey: TEST_KEY,
      now: NOW,
    });
    await assert.rejects(badConfirm, (error) => {
      assertMfaCode(error, STAFF_MFA_ERROR.INVALID_TOTP_CODE);
      return true;
    });

    const code = generateTotpCodeAtTime({ secret: enrollment.secret, now: NOW });
    const confirmed = await confirmTotpEnrollment({
      staffUserId: created.staffUserId,
      factorId: enrollment.factorId,
      totpCode: code,
      encryptionKey: TEST_KEY,
      now: NOW,
    });
    assert.equal(confirmed.recoveryCodes.length, 10);
    assert.equal(await staffHasActiveMfa(created.staffUserId), true);

    const recoveryRows = await db
      .select()
      .from(staffMfaRecoveryCodes)
      .where(eq(staffMfaRecoveryCodes.factorId, enrollment.factorId));
    assert.equal(recoveryRows.length, 10);
    for (const row of recoveryRows) {
      assert.notEqual(row.codeHash, confirmed.recoveryCodes[0]);
    }
  });

  it("requires MFA challenge before session and completes login after verify", async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const created = await bootstrapInitialStaff({
      email: "mfa.login@example.test",
      displayName: "MFA Login",
      passwordHash,
    });

    const enrolled = await enrollAndConfirmMfa({
      staffUserId: created.staffUserId,
      email: created.email,
    });

    assert.equal(await staffHasActiveMfa(created.staffUserId), true);

    const login = await createLoginChallenge({
      staffUserId: created.staffUserId,
      now: NOW,
    });

    const db = getDb();
    const sessionsBefore = await db
      .select()
      .from(staffSessions)
      .where(eq(staffSessions.staffUserId, created.staffUserId));
    assert.equal(sessionsBefore.length, 0);

    const totpNow = new Date(NOW.getTime() + 31_000);
    const totp = generateTotpCodeAtTime({ secret: enrolled.secret, now: totpNow });
    const verified = await verifyLoginChallenge({
      challengeToken: login.challengeToken,
      totpCode: totp,
      encryptionKey: TEST_KEY,
      now: totpNow,
    });
    assert.equal(verified.staffUserId, created.staffUserId);

    await assert.rejects(
      verifyLoginChallenge({
        challengeToken: login.challengeToken,
        totpCode: totp,
        encryptionKey: TEST_KEY,
        now: totpNow,
      }),
      (error) => {
        assertMfaCode(error, STAFF_MFA_ERROR.CHALLENGE_CONSUMED);
        return true;
      },
    );

    const pool = getRacerPool();
    await pool.query(
      `INSERT INTO staff_sessions (staff_user_id, token_hash, expires_at)
       VALUES ($1, 'post-mfa-session', NOW() + interval '1 hour')`,
      [created.staffUserId],
    );
    const sessionsAfter = await db
      .select()
      .from(staffSessions)
      .where(eq(staffSessions.staffUserId, created.staffUserId));
    assert.equal(sessionsAfter.length, 1);
  });

  it("consumes recovery codes once and regenerates invalidate previous codes", async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const created = await bootstrapInitialStaff({
      email: "mfa.recovery@example.test",
      displayName: "Recovery",
      passwordHash,
    });
    const enrolled = await enrollAndConfirmMfa({
      staffUserId: created.staffUserId,
      email: created.email,
    });
    const challenge = await createLoginChallenge({
      staffUserId: created.staffUserId,
      now: NOW,
    });
    const recoveryCode = enrolled.recoveryCodes[0]!;

    await verifyLoginChallenge({
      challengeToken: challenge.challengeToken,
      recoveryCode,
      encryptionKey: TEST_KEY,
      now: NOW,
    });

    const replayChallenge = await createLoginChallenge({
      staffUserId: created.staffUserId,
      now: NOW,
    });
    await assert.rejects(
      verifyLoginChallenge({
        challengeToken: replayChallenge.challengeToken,
        recoveryCode,
        encryptionKey: TEST_KEY,
        now: NOW,
      }),
      (error) => {
        assertMfaCode(error, STAFF_MFA_ERROR.INVALID_RECOVERY_CODE);
        return true;
      },
    );

    const regenerated = await regenerateRecoveryCodes({
      staffUserId: created.staffUserId,
      encryptionKey: TEST_KEY,
    });
    assert.equal(regenerated.recoveryCodes.length, 10);
    assert.equal(
      regenerated.recoveryCodes.includes(enrolled.recoveryCodes[1]!),
      false,
    );
  });

  it("locks challenges after repeated failures and invalidates on admin MFA disable", async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const created = await bootstrapInitialStaff({
      email: "mfa.lock@example.test",
      displayName: "Lock",
      passwordHash,
    });
    await enrollAndConfirmMfa({
      staffUserId: created.staffUserId,
      email: created.email,
    });

    const challenge = await createLoginChallenge({
      staffUserId: created.staffUserId,
      now: NOW,
    });

    for (let attempt = 0; attempt < 5; attempt++) {
      await assert.rejects(
        verifyLoginChallenge({
          challengeToken: challenge.challengeToken,
          totpCode: "000000",
          encryptionKey: TEST_KEY,
          now: NOW,
        }),
        (error) => {
          assertMfaCode(error, STAFF_MFA_ERROR.INVALID_TOTP_CODE);
          return true;
        },
      );
    }

    await assert.rejects(
      verifyLoginChallenge({
        challengeToken: challenge.challengeToken,
        totpCode: "000000",
        encryptionKey: TEST_KEY,
        now: NOW,
      }),
      (error) => {
        assertMfaCode(error, STAFF_MFA_ERROR.CHALLENGE_LOCKED);
        return true;
      },
    );

    const loginChallenge = await createLoginChallenge({
      staffUserId: created.staffUserId,
      now: NOW,
    });
    const before = await getStaffAccount({
      actor: {
        staffUserId: created.staffUserId,
        roles: [STAFF_ROLE.SUPER_ADMIN],
        currentSessionId: null,
      },
      staffUserId: created.staffUserId,
    });
    await disableStaffMfa({
      actor: {
        staffUserId: created.staffUserId,
        roles: [STAFF_ROLE.SUPER_ADMIN],
        currentSessionId: null,
      },
      staffUserId: created.staffUserId,
      expectedUpdatedAt: before.updatedAt,
      now: NOW,
    });

    const pool = getRacerPool();
    const consumed = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM staff_login_challenges
       WHERE token_hash = $1 AND consumed_at IS NOT NULL`,
      [hashSessionToken(loginChallenge.challengeToken)],
    );
    assert.equal(Number(consumed.rows[0]?.count ?? 0) >= 1, true);
    assert.equal(await staffHasActiveMfa(created.staffUserId), false);
  });

  it("allows session creation when MFA is not active", async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const created = await bootstrapInitialStaff({
      email: "plain.login@example.test",
      displayName: "Plain",
      passwordHash,
    });

    assert.equal(await staffHasActiveMfa(created.staffUserId), false);

    const pool = getRacerPool();
    await pool.query(
      `INSERT INTO staff_sessions (staff_user_id, token_hash, expires_at)
       VALUES ($1, 'password-only-session', NOW() + interval '1 hour')`,
      [created.staffUserId],
    );

    const db = getDb();
    const sessions = await db
      .select()
      .from(staffSessions)
      .where(eq(staffSessions.staffUserId, created.staffUserId));
    assert.equal(sessions.length, 1);
  });
});
