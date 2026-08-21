import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAPABILITY,
  STAFF_MFA_FACTOR_KIND,
  STAFF_MFA_FACTOR_STATUS,
  STAFF_ROLE,
  STAFF_SCOPE_MODE,
  STAFF_SESSION_LIST_MAX,
  STAFF_SESSION_STATE,
  STAFF_STATUS,
  staffProjectionLeaksSensitiveMaterial,
  type SafeStaffAccountProjection,
} from "@magazine/domain";
import {
  assertSafeStaffHttpPayload,
  serializeStaffAccountDetail,
  serializeStaffAccountListItem,
  serializeStaffSession,
  serializeStaffSessionList,
} from "./serialize";

const NOW = new Date("2026-08-20T08:00:00.000Z");

const account = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.test",
  displayName: "Admin",
  status: STAFF_STATUS.ACTIVE,
  scopeMode: STAFF_SCOPE_MODE.ALL,
  roles: [STAFF_ROLE.SUPER_ADMIN],
  capabilities: [CAPABILITY.STAFF_MANAGE],
  scopedCategoryIds: [],
  createdAt: NOW,
  updatedAt: NOW,
  disabledAt: null,
  passwordChangedAt: NOW,
  passwordResetRequired: false,
  failedLoginCount: 3,
  lockedUntil: NOW,
  mfa: {
    enrolled: true,
    factorKind: STAFF_MFA_FACTOR_KIND.TOTP,
    status: STAFF_MFA_FACTOR_STATUS.ACTIVE,
    confirmedAt: NOW,
    disabledAt: null,
    unusedRecoveryCodeCount: 8,
  },
  passwordHash: "SHOULD-NOT-COPY",
  tokenHash: "SHOULD-NOT-COPY",
  secretCiphertext: "SHOULD-NOT-COPY",
  recoveryCodeHash: "SHOULD-NOT-COPY",
} as SafeStaffAccountProjection & {
  passwordHash: string;
  tokenHash: string;
  secretCiphertext: string;
  recoveryCodeHash: string;
};

function assertNoSensitiveKeys(value: unknown) {
  assert.equal(staffProjectionLeaksSensitiveMaterial(value), false);
  const json = JSON.stringify(value);
  for (const needle of [
    "passwordHash",
    "tokenHash",
    "token",
    "secret",
    "secretCiphertext",
    "recoveryCode",
    "recoveryCodeHash",
    "SHOULD-NOT-COPY",
    "failedLoginCount",
    "lockedUntil",
  ]) {
    if (needle === "token") {
      assert.equal(json.includes('"token"'), false);
      continue;
    }
    assert.equal(json.includes(needle), false, `leaked ${needle}`);
  }
}

describe("staff HTTP projections", () => {
  it("serializes list and detail without lockout or secret fields", () => {
    const listItem = serializeStaffAccountListItem(account);
    const detail = serializeStaffAccountDetail(account);
    assert.equal(listItem.email, "admin@example.test");
    assert.equal(listItem.capabilities.includes(CAPABILITY.STAFF_MANAGE), true);
    assert.equal(listItem.mfa.enrolled, true);
    assert.equal("passwordChangedAt" in listItem, false);
    assert.equal(detail.passwordChangedAt, NOW.toISOString());
    assert.equal(detail.updatedAt, NOW.toISOString());
    assertNoSensitiveKeys(listItem);
    assertNoSensitiveKeys(detail);
    assertSafeStaffHttpPayload({ items: [listItem], staff: detail });
  });

  it("serializes sessions without token material and documents the bound", () => {
    const session = serializeStaffSession({
      id: "55555555-5555-4555-8555-555555555555",
      createdAt: NOW,
      lastSeenAt: NOW,
      expiresAt: NOW,
      revokedAt: null,
      state: STAFF_SESSION_STATE.ACTIVE,
    });
    const listed = serializeStaffSessionList([
      {
        id: session.id,
        createdAt: NOW,
        lastSeenAt: NOW,
        expiresAt: NOW,
        revokedAt: null,
        state: STAFF_SESSION_STATE.ACTIVE,
      },
    ]);
    assert.equal(listed.bound, STAFF_SESSION_LIST_MAX);
    assert.equal(session.state, STAFF_SESSION_STATE.ACTIVE);
    assertNoSensitiveKeys(listed);
  });
});
