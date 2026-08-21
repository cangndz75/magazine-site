import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  STAFF_ADMIN_ERROR,
  STAFF_MFA_FACTOR_KIND,
  STAFF_MFA_FACTOR_STATUS,
  STAFF_ROLE,
  STAFF_SCOPE_MODE,
  STAFF_SECURITY_AUDIT_EVENT_TYPE,
  STAFF_STATUS,
  StaffAdminError,
  hashSessionToken,
  staffProjectionLeaksSensitiveMaterial,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  disableStaffMfa,
  getStaffAccount,
  listStaffSecurityAuditEvents,
  listStaffSessions,
  requireStaffPasswordReset,
  revokeAllStaffSessions,
  revokeStaffSession,
  setStaffAccountStatus,
  setStaffRoles,
  setStaffScope,
  type StaffAdminActor,
} from "../staff-administration";
import { bootstrapInitialStaff } from "../staff-provisioning";
import {
  staffMfaFactors,
  staffMfaRecoveryCodes,
  staffMfaSecrets,
  staffPasswordCredentials,
  staffSessions,
  staffUserRoles,
  staffUsers,
} from "../schema/staff";
import {
  cleanupStaffAuthTables,
  closeIntegrationConnections,
  ensureEditorContentTestDatabase,
  getRacerPool,
} from "./harness";
import { hashPassword } from "../../../../apps/editor/src/lib/auth/password-core";

function assertAdminCode(error: unknown, code: string): void {
  assert.equal(error instanceof StaffAdminError, true, String(error));
  assert.equal((error as StaffAdminError).code, code);
}

describe("staff administration PostgreSQL foundation", () => {
  let superAdmin: StaffAdminActor;
  let secondAdminId: string;
  let editorId: string;
  let authorId: string;
  let editorActor: StaffAdminActor;
  let authorActor: StaffAdminActor;

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    await cleanupStaffAuthTables();
    const passwordHash = await hashPassword("correct-horse-battery");
    const created = await bootstrapInitialStaff({
      email: "super.admin@example.test",
      displayName: "Super Admin",
      passwordHash,
    });
    superAdmin = {
      staffUserId: created.staffUserId,
      roles: [STAFF_ROLE.SUPER_ADMIN],
      currentSessionId: null,
    };

    const db = getDb();
    const now = new Date();
    secondAdminId = randomUUID();
    editorId = randomUUID();
    authorId = randomUUID();

    await db.insert(staffUsers).values([
      {
        id: secondAdminId,
        email: "second.admin@example.test",
        displayName: "Second Admin",
        status: STAFF_STATUS.ACTIVE,
        scopeMode: STAFF_SCOPE_MODE.ALL,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: editorId,
        email: "editor@example.test",
        displayName: "Editor",
        status: STAFF_STATUS.ACTIVE,
        scopeMode: STAFF_SCOPE_MODE.ALL,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: authorId,
        email: "author@example.test",
        displayName: "Author",
        status: STAFF_STATUS.ACTIVE,
        scopeMode: STAFF_SCOPE_MODE.SELECTED,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(staffPasswordCredentials).values([
      { staffUserId: secondAdminId, passwordHash, passwordChangedAt: now },
      { staffUserId: editorId, passwordHash, passwordChangedAt: now },
      { staffUserId: authorId, passwordHash, passwordChangedAt: now },
    ]);
    await db.insert(staffUserRoles).values([
      { staffUserId: secondAdminId, role: STAFF_ROLE.SUPER_ADMIN },
      { staffUserId: editorId, role: STAFF_ROLE.EDITOR },
      { staffUserId: authorId, role: STAFF_ROLE.AUTHOR },
    ]);

    editorActor = {
      staffUserId: editorId,
      roles: [STAFF_ROLE.EDITOR],
      currentSessionId: null,
    };
    authorActor = {
      staffUserId: authorId,
      roles: [STAFF_ROLE.AUTHOR],
      currentSessionId: null,
    };
  });

  afterEach(async () => {
    await cleanupStaffAuthTables();
  });

  after(async () => {
    await closeIntegrationConnections();
  });

  async function insertSession(staffUserId: string, token: string) {
    const db = getDb();
    const now = new Date();
    const [row] = await db
      .insert(staffSessions)
      .values({
        staffUserId,
        tokenHash: hashSessionToken(token),
        createdAt: now,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      })
      .returning({ id: staffSessions.id });
    if (!row) {
      throw new Error("session insert failed");
    }
    return row.id;
  }

  it("denies Editor and Author staff administration", async () => {
    await assert.rejects(
      () => getStaffAccount({ actor: editorActor, staffUserId: editorId }),
      (error) => {
        assertAdminCode(error, STAFF_ADMIN_ERROR.FORBIDDEN);
        return true;
      },
    );
    await assert.rejects(
      () =>
        setStaffAccountStatus({
          actor: authorActor,
          staffUserId: editorId,
          status: STAFF_STATUS.DISABLED,
          expectedUpdatedAt: new Date(),
        }),
      (error) => {
        assertAdminCode(error, STAFF_ADMIN_ERROR.FORBIDDEN);
        return true;
      },
    );
  });

  it("returns a safe staff projection that never leaks hash, token, or MFA secret", async () => {
    const db = getDb();
    const [factor] = await db
      .insert(staffMfaFactors)
      .values({
        staffUserId: editorId,
        kind: STAFF_MFA_FACTOR_KIND.TOTP,
        status: STAFF_MFA_FACTOR_STATUS.ACTIVE,
        confirmedAt: new Date(),
      })
      .returning({ id: staffMfaFactors.id });
    if (!factor) {
      throw new Error("factor insert failed");
    }
    await db.insert(staffMfaSecrets).values({
      factorId: factor.id,
      secretCiphertext: "PLANTED-MFA-SECRET-VALUE",
    });
    await db.insert(staffMfaRecoveryCodes).values({
      factorId: factor.id,
      codeHash: "planted-recovery-hash-16",
    });
    await insertSession(editorId, "raw-session-token-value");

    const account = await getStaffAccount({
      actor: superAdmin,
      staffUserId: editorId,
    });
    const serialized = JSON.stringify(account);
    assert.equal(account.roles.includes(STAFF_ROLE.EDITOR), true);
    assert.equal(account.mfa.enrolled, true);
    assert.equal(staffProjectionLeaksSensitiveMaterial(account), false);
    assert.equal(serialized.includes("PLANTED-MFA-SECRET-VALUE"), false);
    assert.equal(serialized.includes("planted-recovery-hash-16"), false);
    assert.equal(serialized.includes("raw-session-token-value"), false);
    assert.equal(serialized.includes("$argon2id$"), false);
    assert.equal("passwordHash" in account, false);
    assert.equal("secretCiphertext" in account.mfa, false);
  });

  it("suspends and reactivates a staff user, revoking sessions and blocking auth state", async () => {
    const sessionId = await insertSession(editorId, "editor-session");
    const before = await getStaffAccount({
      actor: superAdmin,
      staffUserId: editorId,
    });

    const suspended = await setStaffAccountStatus({
      actor: superAdmin,
      staffUserId: editorId,
      status: STAFF_STATUS.DISABLED,
      expectedUpdatedAt: before.updatedAt,
    });
    assert.equal(suspended.status, STAFF_STATUS.DISABLED);
    assert.equal(suspended.disabledAt !== null, true);

    const sessions = await listStaffSessions({
      actor: superAdmin,
      staffUserId: editorId,
    });
    assert.equal(sessions.some((row) => row.id === sessionId && row.revokedAt), true);

    const reactivated = await setStaffAccountStatus({
      actor: superAdmin,
      staffUserId: editorId,
      status: STAFF_STATUS.ACTIVE,
      expectedUpdatedAt: suspended.updatedAt,
    });
    assert.equal(reactivated.status, STAFF_STATUS.ACTIVE);
    assert.equal(reactivated.disabledAt, null);

    const events = await listStaffSecurityAuditEvents({
      actor: superAdmin,
      staffUserId: editorId,
    });
    assert.equal(
      events.some((event) => event.eventType === STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SUSPENDED),
      true,
    );
    assert.equal(
      events.some((event) => event.eventType === STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_REACTIVATED),
      true,
    );
  });

  it("revokes one session and all other sessions while preserving the current Super Admin session", async () => {
    const keep = await insertSession(superAdmin.staffUserId, "admin-current");
    const other = await insertSession(superAdmin.staffUserId, "admin-other");
    const editorSession = await insertSession(editorId, "editor-one");
    const editorSessionTwo = await insertSession(editorId, "editor-two");

    const one = await revokeStaffSession({
      actor: superAdmin,
      staffUserId: editorId,
      sessionId: editorSession,
    });
    assert.equal(one.revoked, true);

    const allEditor = await revokeAllStaffSessions({
      actor: superAdmin,
      staffUserId: editorId,
    });
    assert.equal(allEditor.revokedSessionCount >= 1, true);
    assert.equal(allEditor.preservedSessionId, null);

    const self = await revokeAllStaffSessions({
      actor: { ...superAdmin, currentSessionId: keep },
      staffUserId: superAdmin.staffUserId,
    });
    assert.equal(self.preservedSessionId, keep);

    const adminSessions = await listStaffSessions({
      actor: superAdmin,
      staffUserId: superAdmin.staffUserId,
    });
    const kept = adminSessions.find((row) => row.id === keep);
    const gone = adminSessions.find((row) => row.id === other);
    assert.equal(kept?.revokedAt, null);
    assert.equal(gone?.revokedAt !== null, true);

    const leftoverEditor = await listStaffSessions({
      actor: superAdmin,
      staffUserId: editorId,
    });
    assert.equal(
      leftoverEditor.every((row) => row.revokedAt !== null),
      true,
    );
    assert.equal(
      leftoverEditor.some((row) => row.id === editorSessionTwo),
      true,
    );
  });

  it("rejects a stale staff mutation and does not overwrite role or status", async () => {
    const before = await getStaffAccount({
      actor: superAdmin,
      staffUserId: editorId,
    });
    await assert.rejects(
      () =>
        setStaffRoles({
          actor: superAdmin,
          staffUserId: editorId,
          roles: [STAFF_ROLE.AUTHOR],
          expectedUpdatedAt: new Date("2020-01-01T00:00:00.000Z"),
        }),
      (error) => {
        assertAdminCode(error, STAFF_ADMIN_ERROR.STAFF_WRITE_CONFLICT);
        return true;
      },
    );
    const after = await getStaffAccount({
      actor: superAdmin,
      staffUserId: editorId,
    });
    assert.deepEqual(after.roles, before.roles);
    assert.equal(after.status, before.status);
    assert.equal(after.updatedAt.toISOString(), before.updatedAt.toISOString());
  });

  it("prevents removing or disabling the last viable Super Admin and ignores forged capabilities", async () => {
    await setStaffAccountStatus({
      actor: superAdmin,
      staffUserId: secondAdminId,
      status: STAFF_STATUS.DISABLED,
      expectedUpdatedAt: (
        await getStaffAccount({ actor: superAdmin, staffUserId: secondAdminId })
      ).updatedAt,
    });

    const last = await getStaffAccount({
      actor: superAdmin,
      staffUserId: superAdmin.staffUserId,
    });
    await assert.rejects(
      () =>
        setStaffAccountStatus({
          actor: superAdmin,
          staffUserId: superAdmin.staffUserId,
          status: STAFF_STATUS.DISABLED,
          expectedUpdatedAt: last.updatedAt,
        }),
      (error) => {
        assertAdminCode(error, STAFF_ADMIN_ERROR.LAST_SUPER_ADMIN);
        return true;
      },
    );
    await assert.rejects(
      () =>
        setStaffRoles({
          actor: superAdmin,
          staffUserId: superAdmin.staffUserId,
          roles: [STAFF_ROLE.EDITOR],
          expectedUpdatedAt: last.updatedAt,
        }),
      (error) => {
        assertAdminCode(error, STAFF_ADMIN_ERROR.LAST_SUPER_ADMIN);
        return true;
      },
    );
    const editorAccount = await getStaffAccount({
      actor: superAdmin,
      staffUserId: editorId,
    });
    await assert.rejects(
      () =>
        setStaffRoles({
          actor: editorActor,
          staffUserId: editorId,
          roles: [STAFF_ROLE.SUPER_ADMIN],
          expectedUpdatedAt: editorAccount.updatedAt,
        }),
      (error) => {
        assertAdminCode(error, STAFF_ADMIN_ERROR.FORBIDDEN);
        return true;
      },
    );
  });

  it("requires a password reset, revokes sessions, and lets CLI reset clear the flag", async () => {
    await insertSession(editorId, "pre-reset");
    const before = await getStaffAccount({
      actor: superAdmin,
      staffUserId: editorId,
    });
    const required = await requireStaffPasswordReset({
      actor: superAdmin,
      staffUserId: editorId,
      expectedUpdatedAt: before.updatedAt,
    });
    assert.equal(required.passwordResetRequired, true);
    const sessions = await listStaffSessions({
      actor: superAdmin,
      staffUserId: editorId,
    });
    assert.equal(sessions.every((row) => row.revokedAt !== null), true);

    const { resetStaffPassword } = await import("../staff-password-reset");
    const nextHash = await hashPassword("another-correct-secret");
    await resetStaffPassword({
      email: "editor@example.test",
      passwordHash: nextHash,
    });
    const after = await getStaffAccount({
      actor: superAdmin,
      staffUserId: editorId,
    });
    assert.equal(after.passwordResetRequired, false);
  });

  it("disables MFA status without returning secret material", async () => {
    const db = getDb();
    const [factor] = await db
      .insert(staffMfaFactors)
      .values({
        staffUserId: editorId,
        kind: STAFF_MFA_FACTOR_KIND.TOTP,
        status: STAFF_MFA_FACTOR_STATUS.ACTIVE,
        confirmedAt: new Date(),
      })
      .returning({ id: staffMfaFactors.id, staffUserId: staffMfaFactors.staffUserId });
    if (!factor) {
      throw new Error("factor insert failed");
    }
    await db.insert(staffMfaSecrets).values({
      factorId: factor.id,
      secretCiphertext: "ADMIN-MUST-NOT-SEE-THIS",
    });
    const before = await getStaffAccount({
      actor: superAdmin,
      staffUserId: editorId,
    });
    const disabled = await disableStaffMfa({
      actor: superAdmin,
      staffUserId: editorId,
      expectedUpdatedAt: before.updatedAt,
    });
    assert.equal(disabled.mfa.status, STAFF_MFA_FACTOR_STATUS.DISABLED);
    assert.equal(disabled.mfa.enrolled, false);
    const serialized = JSON.stringify(disabled);
    assert.equal(serialized.includes("ADMIN-MUST-NOT-SEE-THIS"), false);

    const pool = getRacerPool();
    const leftover = await pool.query(
      "SELECT count(*)::int AS n FROM staff_mfa_secrets WHERE factor_id = $1",
      [factor.id],
    );
    assert.equal(leftover.rows[0]?.n, 0);

    const events = await listStaffSecurityAuditEvents({
      actor: superAdmin,
      staffUserId: editorId,
    });
    assert.equal(
      events.some(
        (event) =>
          event.eventType === STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_MFA_DISABLED &&
          !JSON.stringify(event.changeSet).includes("ADMIN-MUST-NOT-SEE-THIS"),
      ),
      true,
    );
  });

  it("updates category scope without trusting a capability list", async () => {
    const before = await getStaffAccount({
      actor: superAdmin,
      staffUserId: authorId,
    });
    const updated = await setStaffScope({
      actor: superAdmin,
      staffUserId: authorId,
      scopeMode: STAFF_SCOPE_MODE.ALL,
      scopedCategoryIds: [],
      expectedUpdatedAt: before.updatedAt,
    });
    assert.equal(updated.scopeMode, STAFF_SCOPE_MODE.ALL);
    assert.deepEqual(updated.scopedCategoryIds, []);
    assert.equal(updated.capabilities.includes("STAFF_MANAGE"), false);

    await assert.rejects(
      () =>
        setStaffScope({
          actor: superAdmin,
          staffUserId: authorId,
          scopeMode: STAFF_SCOPE_MODE.SELECTED,
          scopedCategoryIds: [randomUUID()],
          expectedUpdatedAt: updated.updatedAt,
        }),
      (error) => {
        assertAdminCode(error, STAFF_ADMIN_ERROR.INVALID_SCOPE);
        return true;
      },
    );
  });
});
