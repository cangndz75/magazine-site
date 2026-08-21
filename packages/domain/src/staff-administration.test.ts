import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAPABILITY } from "./capability";
import { STAFF_ROLE } from "./staff-role";
import { STAFF_SCOPE_MODE } from "./staff-scope-mode";
import { STAFF_STATUS } from "./staff-status";
import {
  STAFF_ADMIN_ERROR,
  STAFF_MFA_FACTOR_KIND,
  STAFF_MFA_FACTOR_STATUS,
  STAFF_SECURITY_AUDIT_EVENT_TYPE,
  STAFF_SESSION_STATE,
  authorizeStaffAdministration,
  canonicalizeStaffRoles,
  decideDisableStaffMfa,
  decideRequireStaffPasswordReset,
  decideRevokeAllStaffSessions,
  decideStaffAccountStatusChange,
  decideStaffRoleChange,
  decideStaffScopeChange,
  decideStaffSessionRevoke,
  presentStaffSessionState,
  staffProjectionLeaksSensitiveMaterial,
  staffSecurityAuditOmitsSecrets,
  toSafeStaffAccountProjection,
  toSafeStaffMfaProjection,
  toSafeStaffSessionProjection,
  wouldRemoveLastSuperAdmin,
} from "./staff-administration";

const NOW = new Date("2026-08-20T08:00:00.000Z");
const TOKEN = "2026-08-20T08:00:00.000Z";

describe("staff administration authorization", () => {
  it("permits Super Admin via STAFF_MANAGE", () => {
    assert.deepEqual(
      authorizeStaffAdministration({ roles: [STAFF_ROLE.SUPER_ADMIN] }),
      { ok: true, value: true },
    );
  });

  it("denies Editor and Author", () => {
    assert.equal(
      authorizeStaffAdministration({ roles: [STAFF_ROLE.EDITOR] }).ok,
      false,
    );
    assert.equal(
      authorizeStaffAdministration({ roles: [STAFF_ROLE.AUTHOR] }).ok,
      false,
    );
  });
});

describe("safe staff projections", () => {
  it("exposes roles, derived capabilities, and MFA status without secrets", () => {
    const projection = toSafeStaffAccountProjection({
      id: "11111111-1111-4111-8111-111111111111",
      email: "admin@example.test",
      displayName: "Admin",
      status: STAFF_STATUS.ACTIVE,
      scopeMode: STAFF_SCOPE_MODE.ALL,
      roles: [STAFF_ROLE.SUPER_ADMIN],
      scopedCategoryIds: [],
      createdAt: NOW,
      updatedAt: NOW,
      disabledAt: null,
      passwordChangedAt: NOW,
      passwordResetRequiredAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      mfa: {
        kind: STAFF_MFA_FACTOR_KIND.TOTP,
        status: STAFF_MFA_FACTOR_STATUS.ACTIVE,
        confirmedAt: NOW,
        disabledAt: null,
        unusedRecoveryCodeCount: 8,
      },
    });

    assert.equal(projection.capabilities.includes(CAPABILITY.STAFF_MANAGE), true);
    assert.equal(projection.mfa.enrolled, true);
    assert.equal(projection.mfa.factorKind, STAFF_MFA_FACTOR_KIND.TOTP);
    assert.equal(staffProjectionLeaksSensitiveMaterial(projection), false);
    assert.equal(
      JSON.stringify(projection).includes("otpauth://"),
      false,
    );
    assert.equal(JSON.stringify(projection).includes("argon2"), false);
  });

  it("does not copy password hashes, session tokens, or MFA secrets even if present on the source object", () => {
    const raw = {
      id: "11111111-1111-4111-8111-111111111111",
      email: "editor@example.test",
      displayName: "Editor",
      status: STAFF_STATUS.ACTIVE,
      scopeMode: STAFF_SCOPE_MODE.SELECTED,
      roles: [STAFF_ROLE.EDITOR],
      scopedCategoryIds: ["22222222-2222-4222-8222-222222222222"],
      createdAt: NOW,
      updatedAt: NOW,
      disabledAt: null,
      passwordChangedAt: NOW,
      passwordResetRequiredAt: null,
      failedLoginCount: 2,
      lockedUntil: null,
      mfa: null,
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=1$secret",
      tokenHash: "session-token-hash",
      secretCiphertext: "JBSWY3DPEHPK3PXP",
      recoveryCodes: ["aaaa-bbbb", "cccc-dddd"],
    };

    const projection = toSafeStaffAccountProjection(raw);
    const serialized = JSON.stringify(projection);
    assert.equal(serialized.includes("$argon2id$"), false);
    assert.equal(serialized.includes("session-token-hash"), false);
    assert.equal(serialized.includes("JBSWY3DPEHPK3PXP"), false);
    assert.equal(serialized.includes("aaaa-bbbb"), false);
    assert.equal(staffProjectionLeaksSensitiveMaterial(projection), false);
    assert.equal(staffProjectionLeaksSensitiveMaterial(raw), true);
  });

  it("never includes MFA secret material in the MFA projection", () => {
    const projection = toSafeStaffMfaProjection({
      kind: STAFF_MFA_FACTOR_KIND.TOTP,
      status: STAFF_MFA_FACTOR_STATUS.PENDING,
      confirmedAt: null,
      disabledAt: null,
      unusedRecoveryCodeCount: 0,
    });
    assert.equal(projection.enrolled, false);
    assert.equal("secret" in projection, false);
    assert.equal(staffProjectionLeaksSensitiveMaterial(projection), false);
  });

  it("labels session state without exposing the raw token", () => {
    const session = toSafeStaffSessionProjection({
      id: "33333333-3333-4333-8333-333333333333",
      createdAt: NOW,
      lastSeenAt: NOW,
      expiresAt: new Date("2026-08-20T20:00:00.000Z"),
      revokedAt: null,
      now: NOW,
    });
    assert.equal(session.state, STAFF_SESSION_STATE.ACTIVE);
    assert.equal("tokenHash" in session, false);
    assert.equal(
      presentStaffSessionState({
        revokedAt: NOW,
        expiresAt: new Date("2026-08-20T20:00:00.000Z"),
        now: NOW,
      }),
      STAFF_SESSION_STATE.REVOKED,
    );
  });
});

describe("staff status and last Super Admin", () => {
  it("suspends a non-last Super Admin and requires session revocation", () => {
    const decision = decideStaffAccountStatusChange({
      actorRoles: [STAFF_ROLE.SUPER_ADMIN],
      current: {
        status: STAFF_STATUS.ACTIVE,
        roles: [STAFF_ROLE.SUPER_ADMIN],
        updatedAt: TOKEN,
      },
      nextStatus: STAFF_STATUS.DISABLED,
      expectedUpdatedAt: TOKEN,
      viableSuperAdminCount: 2,
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.value.disable, true);
      assert.equal(decision.value.revokeAllSessions, true);
      assert.equal(
        decision.value.auditEventType,
        STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SUSPENDED,
      );
    }
  });

  it("refuses to disable or demote the last viable Super Admin", () => {
    const disable = decideStaffAccountStatusChange({
      actorRoles: [STAFF_ROLE.SUPER_ADMIN],
      current: {
        status: STAFF_STATUS.ACTIVE,
        roles: [STAFF_ROLE.SUPER_ADMIN],
        updatedAt: TOKEN,
      },
      nextStatus: STAFF_STATUS.DISABLED,
      expectedUpdatedAt: TOKEN,
      viableSuperAdminCount: 1,
    });
    assert.equal(disable.ok, false);
    if (!disable.ok) {
      assert.equal(disable.code, STAFF_ADMIN_ERROR.LAST_SUPER_ADMIN);
    }

    const demote = decideStaffRoleChange({
      actorRoles: [STAFF_ROLE.SUPER_ADMIN],
      current: {
        status: STAFF_STATUS.ACTIVE,
        roles: [STAFF_ROLE.SUPER_ADMIN],
        updatedAt: TOKEN,
      },
      nextRoles: [STAFF_ROLE.EDITOR],
      expectedUpdatedAt: TOKEN,
      viableSuperAdminCount: 1,
    });
    assert.equal(demote.ok, false);
    if (!demote.ok) {
      assert.equal(demote.code, STAFF_ADMIN_ERROR.LAST_SUPER_ADMIN);
    }

    assert.equal(
      wouldRemoveLastSuperAdmin({
        current: {
          status: STAFF_STATUS.ACTIVE,
          roles: [STAFF_ROLE.SUPER_ADMIN],
        },
        nextStatus: STAFF_STATUS.ACTIVE,
        nextRoles: [STAFF_ROLE.EDITOR],
        viableSuperAdminCount: 1,
      }),
      true,
    );
  });

  it("rejects stale status mutations", () => {
    const decision = decideStaffAccountStatusChange({
      actorRoles: [STAFF_ROLE.SUPER_ADMIN],
      current: {
        status: STAFF_STATUS.ACTIVE,
        roles: [STAFF_ROLE.EDITOR],
        updatedAt: TOKEN,
      },
      nextStatus: STAFF_STATUS.DISABLED,
      expectedUpdatedAt: "2026-08-20T07:59:59.000Z",
      viableSuperAdminCount: 1,
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, STAFF_ADMIN_ERROR.STAFF_WRITE_CONFLICT);
    }
  });
});

describe("privilege escalation prevention", () => {
  it("rejects unknown roles instead of trusting request bodies", () => {
    const decision = canonicalizeStaffRoles(["SUPER_ADMIN", "GOD"]);
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, STAFF_ADMIN_ERROR.INVALID_ROLE);
    }
  });

  it("does not let Editor mutate roles even if they send Super Admin in the body", () => {
    const decision = decideStaffRoleChange({
      actorRoles: [STAFF_ROLE.EDITOR],
      current: {
        status: STAFF_STATUS.ACTIVE,
        roles: [STAFF_ROLE.AUTHOR],
        updatedAt: TOKEN,
      },
      nextRoles: [STAFF_ROLE.SUPER_ADMIN],
      expectedUpdatedAt: TOKEN,
      viableSuperAdminCount: 1,
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, STAFF_ADMIN_ERROR.FORBIDDEN);
    }
  });

  it("canonicalizes scopes without accepting capability lists", () => {
    const decision = decideStaffScopeChange({
      actorRoles: [STAFF_ROLE.SUPER_ADMIN],
      currentUpdatedAt: TOKEN,
      expectedUpdatedAt: TOKEN,
      scopeMode: STAFF_SCOPE_MODE.SELECTED,
      scopedCategoryIds: ["22222222-2222-4222-8222-222222222222"],
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.value.scopeMode, STAFF_SCOPE_MODE.SELECTED);
      assert.equal("capabilities" in decision.value, false);
    }
  });
});

describe("session revoke decisions", () => {
  it("revokes a session that belongs to the target", () => {
    assert.deepEqual(
      decideStaffSessionRevoke({
        actorRoles: [STAFF_ROLE.SUPER_ADMIN],
        sessionBelongsToTarget: true,
      }),
      { ok: true, value: true },
    );
  });

  it("preserves the current Super Admin session when revoking all of their own sessions", () => {
    const decision = decideRevokeAllStaffSessions({
      actorRoles: [STAFF_ROLE.SUPER_ADMIN],
      actorStaffUserId: "admin-1",
      targetStaffUserId: "admin-1",
      currentSessionId: "session-current",
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.value.preserveSessionId, "session-current");
    }
  });

  it("revokes every session when Super Admin targets another staff user", () => {
    const decision = decideRevokeAllStaffSessions({
      actorRoles: [STAFF_ROLE.SUPER_ADMIN],
      actorStaffUserId: "admin-1",
      targetStaffUserId: "editor-1",
      currentSessionId: "session-current",
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.value.preserveSessionId, null);
    }
  });
});

describe("security actions", () => {
  it("requires a password reset behind STAFF_MANAGE and concurrency", () => {
    const allowed = decideRequireStaffPasswordReset({
      actorRoles: [STAFF_ROLE.SUPER_ADMIN],
      currentUpdatedAt: TOKEN,
      expectedUpdatedAt: TOKEN,
    });
    assert.equal(allowed.ok, true);

    const denied = decideRequireStaffPasswordReset({
      actorRoles: [STAFF_ROLE.AUTHOR],
      currentUpdatedAt: TOKEN,
      expectedUpdatedAt: TOKEN,
    });
    assert.equal(denied.ok, false);
  });

  it("disables inspectable MFA state without exposing a secret", () => {
    const decision = decideDisableStaffMfa({
      actorRoles: [STAFF_ROLE.SUPER_ADMIN],
      currentUpdatedAt: TOKEN,
      expectedUpdatedAt: TOKEN,
      factorStatus: STAFF_MFA_FACTOR_STATUS.ACTIVE,
    });
    assert.equal(decision.ok, true);
    assert.equal(
      staffSecurityAuditOmitsSecrets({
        previousStatus: STAFF_MFA_FACTOR_STATUS.ACTIVE,
        nextStatus: STAFF_MFA_FACTOR_STATUS.DISABLED,
      }),
      true,
    );
  });
});
