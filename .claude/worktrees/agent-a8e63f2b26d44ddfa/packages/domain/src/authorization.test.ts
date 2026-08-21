import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canPerform, effectiveCapabilities, hasCapability, hasCategoryScope } from "./authorization";
import { CAPABILITY } from "./capability";
import {
  FAILED_LOGIN_LIMIT,
  decidePasswordCredentialTransition,
  isPasswordAuthLocked,
  nextFailedLoginState,
  resetLoginFailures,
  type LoginThrottleState,
} from "./login-throttle";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_ISSUE,
  assertPasswordPolicy,
} from "./password-policy";
import { generateSessionToken, hashSessionToken } from "./session-token";
import { evaluateStaffSession } from "./session-validity";
import { safeInternalPath } from "./safe-internal-path";
import { STAFF_ROLE } from "./staff-role";
import { STAFF_SCOPE_MODE } from "./staff-scope-mode";
import { STAFF_STATUS } from "./staff-status";
import { normalizeStaffEmail } from "./staff-email";

describe("RBAC capabilities", () => {
  it("gives SUPER_ADMIN homepage and staff management", () => {
    assert.equal(
      hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.HOMEPAGE_MANAGE),
      true,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.STAFF_MANAGE),
      true,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.CATEGORY_MANAGE),
      true,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.CONTENT_LEGAL),
      true,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.ANALYTICS_READ),
      true,
    );
  });

  it("does not give EDITOR homepage or staff management", () => {
    assert.equal(
      hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.HOMEPAGE_MANAGE),
      false,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.STAFF_MANAGE),
      false,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.CONTENT_PUBLISH),
      true,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.CONTENT_LEGAL),
      false,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.ANALYTICS_READ),
      true,
    );
  });

  it("does not give AUTHOR homepage, staff management, or publish", () => {
    assert.equal(
      hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.HOMEPAGE_MANAGE),
      false,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.STAFF_MANAGE),
      false,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.CONTENT_PUBLISH),
      false,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.CONTENT_EDIT),
      true,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.ANALYTICS_READ),
      false,
    );
  });

  it("derives capabilities from roles and never from a caller-supplied list", () => {
    assert.deepEqual(effectiveCapabilities([STAFF_ROLE.AUTHOR]), [
      CAPABILITY.CONTENT_READ,
      CAPABILITY.CONTENT_CREATE,
      CAPABILITY.CONTENT_EDIT,
    ]);
    assert.equal(
      effectiveCapabilities([STAFF_ROLE.EDITOR]).includes(CAPABILITY.STAFF_MANAGE),
      false,
    );
    assert.equal(
      effectiveCapabilities([STAFF_ROLE.SUPER_ADMIN]).includes(
        CAPABILITY.STAFF_MANAGE,
      ),
      true,
    );
  });
});

describe("category scope", () => {
  it("passes when scopeMode is ALL", () => {
    assert.equal(
      hasCategoryScope({
        roles: [STAFF_ROLE.EDITOR],
        scopeMode: STAFF_SCOPE_MODE.ALL,
        scopedCategoryIds: [],
        categoryId: "cat-a",
      }),
      true,
    );
  });

  it("accepts an assigned category in SELECTED mode", () => {
    assert.equal(
      hasCategoryScope({
        roles: [STAFF_ROLE.EDITOR],
        scopeMode: STAFF_SCOPE_MODE.SELECTED,
        scopedCategoryIds: ["cat-a", "cat-b"],
        categoryId: "cat-a",
      }),
      true,
    );
  });

  it("rejects an unassigned category in SELECTED mode", () => {
    assert.equal(
      hasCategoryScope({
        roles: [STAFF_ROLE.EDITOR],
        scopeMode: STAFF_SCOPE_MODE.SELECTED,
        scopedCategoryIds: ["cat-a"],
        categoryId: "cat-b",
      }),
      false,
    );
  });

  it("gives SUPER_ADMIN global category scope even in SELECTED mode", () => {
    assert.equal(
      canPerform({
        roles: [STAFF_ROLE.SUPER_ADMIN],
        capability: CAPABILITY.CONTENT_PUBLISH,
        scopeMode: STAFF_SCOPE_MODE.SELECTED,
        scopedCategoryIds: [],
        categoryId: "unassigned",
      }),
      true,
    );
  });
});

describe("password policy", () => {
  it("rejects a password shorter than 12 characters", () => {
    const result = assertPasswordPolicy("12345678901");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.issue, PASSWORD_POLICY_ISSUE.TOO_SHORT);
    }
  });

  it("accepts a 12-character password", () => {
    assert.deepEqual(assertPasswordPolicy("123456789012"), { ok: true });
  });

  it("rejects a password longer than 128 characters", () => {
    const result = assertPasswordPolicy("a".repeat(PASSWORD_MAX_LENGTH + 1));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.issue, PASSWORD_POLICY_ISSUE.TOO_LONG);
    }
  });

  it("does not silently trim password input", () => {
    const padded = " 12345678901";
    assert.equal(padded.length, 12);
    assert.deepEqual(assertPasswordPolicy(padded), { ok: true });
    assert.notEqual(padded, padded.trim());
    assert.equal(assertPasswordPolicy(padded.trim()).ok, false);
  });
});

describe("staff email normalization", () => {
  it("trims and lowercases email, not passwords", () => {
    assert.equal(normalizeStaffEmail("  Editor@Example.COM "), "editor@example.com");
  });

  it("produces a canonical email without surrounding whitespace", () => {
    const canonical = normalizeStaffEmail("\tEditor@Example.COM  ");
    assert.equal(canonical, canonical.trim());
    assert.equal(canonical, canonical.toLowerCase());
    assert.notEqual(" Editor@Example.COM ", canonical);
  });
});

describe("login throttling", () => {
  it("increments failures and locks after the threshold", () => {
    const now = new Date("2026-08-16T12:00:00.000Z");
    let state = resetLoginFailures();

    for (let attempt = 1; attempt < FAILED_LOGIN_LIMIT; attempt += 1) {
      state = nextFailedLoginState(state, now);
      assert.equal(isPasswordAuthLocked(state.lockedUntil, now), false);
    }

    state = nextFailedLoginState(state, now);
    assert.equal(state.failedLoginCount, FAILED_LOGIN_LIMIT);
    assert.equal(isPasswordAuthLocked(state.lockedUntil, now), true);
  });

  it("resets the failure counter after successful authentication", () => {
    const now = new Date("2026-08-16T12:00:00.000Z");
    const failed = nextFailedLoginState(resetLoginFailures(), now);
    const reset = resetLoginFailures();
    assert.equal(reset.failedLoginCount, 0);
    assert.equal(reset.lastFailedLoginAt, null);
    assert.equal(reset.lockedUntil, null);
    assert.notEqual(failed.failedLoginCount, 0);
  });

  it("expired lock allows another attempt; wrong password at threshold starts a new lock without resetting the consecutive-failure count", () => {
    const lockedAt = new Date("2026-08-16T12:00:00.000Z");
    const lockedState = nextFailedLoginState(
      {
        failedLoginCount: FAILED_LOGIN_LIMIT - 1,
        lastFailedLoginAt: lockedAt,
        lockedUntil: null,
      },
      lockedAt,
    );
    const afterExpiry = new Date(lockedAt.getTime() + 15 * 60 * 1000 + 1);
    assert.equal(isPasswordAuthLocked(lockedState.lockedUntil, afterExpiry), false);
    assert.equal(lockedState.failedLoginCount, FAILED_LOGIN_LIMIT);

    const retried = nextFailedLoginState(lockedState, afterExpiry);
    assert.equal(retried.failedLoginCount, FAILED_LOGIN_LIMIT + 1);
    assert.equal(isPasswordAuthLocked(retried.lockedUntil, afterExpiry), true);
  });
});

describe("serialized credential transitions (unit; does not prove PostgreSQL FOR UPDATE)", () => {
  const now = new Date("2026-08-16T12:00:00.000Z");

  function applyWrongPassword(
    throttle: LoginThrottleState,
    at: Date = now,
  ): { throttle: LoginThrottleState; code: string } {
    const decision = decidePasswordCredentialTransition({
      credentialFound: true,
      staffStatus: STAFF_STATUS.ACTIVE,
      throttle,
      passwordMatches: false,
      now: at,
    });
    if (decision.mutate === "record-failure") {
      return { throttle: decision.next, code: decision.code };
    }
    return { throttle, code: decision.code };
  }

  it("serializes 20 wrong-password attempts without losing increments before lock", () => {
    let throttle = resetLoginFailures();
    let lockedRejects = 0;

    for (let i = 0; i < 20; i += 1) {
      const result = applyWrongPassword(throttle);
      throttle = result.throttle;
      if (result.code === "LOCKED") {
        lockedRejects += 1;
      }
    }

    assert.equal(throttle.failedLoginCount, FAILED_LOGIN_LIMIT);
    assert.equal(isPasswordAuthLocked(throttle.lockedUntil, now), true);
    assert.equal(lockedRejects, 20 - FAILED_LOGIN_LIMIT);
  });

  it("orders a success/fail race by applying the locked-row transition, not stale counts", () => {
    const fourFails = {
      failedLoginCount: 4,
      lastFailedLoginAt: now,
      lockedUntil: null,
    };

    const failFirst = decidePasswordCredentialTransition({
      credentialFound: true,
      staffStatus: STAFF_STATUS.ACTIVE,
      throttle: fourFails,
      passwordMatches: false,
      now,
    });
    assert.equal(failFirst.mutate, "record-failure");
    if (failFirst.mutate !== "record-failure") {
      throw new Error("expected failure mutation");
    }
    const afterFail = failFirst.next;
    assert.equal(afterFail.failedLoginCount, 5);
    assert.equal(isPasswordAuthLocked(afterFail.lockedUntil, now), true);

    const successAfterFail = decidePasswordCredentialTransition({
      credentialFound: true,
      staffStatus: STAFF_STATUS.ACTIVE,
      throttle: afterFail,
      passwordMatches: true,
      now,
    });
    assert.equal(successAfterFail.mutate, false);
    if (successAfterFail.mutate !== false) {
      throw new Error("expected lock to block success while lock is active");
    }
    assert.equal(successAfterFail.code, "LOCKED");

    const successFirst = decidePasswordCredentialTransition({
      credentialFound: true,
      staffStatus: STAFF_STATUS.ACTIVE,
      throttle: fourFails,
      passwordMatches: true,
      now,
    });
    assert.equal(successFirst.mutate, "reset");
    if (successFirst.mutate !== "reset") {
      throw new Error("expected reset");
    }
    const afterSuccess = successFirst.next;

    const failAfterSuccess = decidePasswordCredentialTransition({
      credentialFound: true,
      staffStatus: STAFF_STATUS.ACTIVE,
      throttle: afterSuccess,
      passwordMatches: false,
      now,
    });
    assert.equal(failAfterSuccess.mutate, "record-failure");
    if (failAfterSuccess.mutate !== "record-failure") {
      throw new Error("expected failure mutation");
    }
    assert.equal(failAfterSuccess.next.failedLoginCount, 1);
    assert.equal(failAfterSuccess.next.lockedUntil, null);
  });

  it("does not persist a failure counter when no credential row exists", () => {
    const decision = decidePasswordCredentialTransition({
      credentialFound: false,
      staffStatus: null,
      throttle: resetLoginFailures(),
      passwordMatches: false,
      now,
    });
    assert.deepEqual(decision, { mutate: false, code: "UNKNOWN_USER" });
  });

  it("rejects a matching password when a password reset is required", () => {
    const decision = decidePasswordCredentialTransition({
      credentialFound: true,
      staffStatus: STAFF_STATUS.ACTIVE,
      throttle: resetLoginFailures(),
      passwordMatches: true,
      now,
      passwordResetRequiredAt: now,
    });
    assert.deepEqual(decision, { mutate: false, code: "PASSWORD_RESET_REQUIRED" });
  });
});

describe("session token", () => {
  it("generates a strong random token distinct from its hash", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    assert.equal(token.length >= 43, true);
    assert.notEqual(token, hash);
    assert.equal(hashSessionToken(token), hash);
  });

  it("generates distinct tokens", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();
    assert.notEqual(first, second);
  });
});

describe("safe internal path", () => {
  it("accepts same-app relative paths", () => {
    assert.equal(safeInternalPath("/"), "/");
    assert.equal(safeInternalPath("/articles"), "/articles");
    assert.equal(safeInternalPath("/articles?id=1"), "/articles?id=1");
  });

  it("rejects open redirects without decoding", () => {
    assert.equal(safeInternalPath("https://evil.example"), "/");
    assert.equal(safeInternalPath("//evil.example"), "/");
    assert.equal(safeInternalPath("\\evil.example"), "/");
    assert.equal(safeInternalPath("\\\\evil.example"), "/");
    assert.equal(safeInternalPath("/\\evil"), "/");
    assert.equal(safeInternalPath("javascript:alert(1)"), "/");
    assert.equal(safeInternalPath("data:text/html,test"), "/");
    assert.equal(safeInternalPath("dashboard"), "/");
  });

  it("rejects encoded protocol-relative and backslash redirects after decoding", () => {
    assert.equal(safeInternalPath("/%2f%2fevil.example"), "/");
    assert.equal(safeInternalPath("/%2F%2Fevil.example"), "/");
    assert.equal(safeInternalPath("/%5c%5cevil.example"), "/");
    assert.equal(safeInternalPath("/%5C%5Cevil.example"), "/");
  });
});

describe("session validation", () => {
  const now = new Date("2026-08-16T12:00:00.000Z");
  const later = new Date("2026-08-16T20:00:00.000Z");

  it("accepts an active session for an active user", () => {
    assert.deepEqual(
      evaluateStaffSession({
        revokedAt: null,
        expiresAt: later,
        now,
        staffStatus: STAFF_STATUS.ACTIVE,
      }),
      { ok: true },
    );
  });

  it("rejects a revoked session", () => {
    const result = evaluateStaffSession({
      revokedAt: now,
      expiresAt: later,
      now,
      staffStatus: STAFF_STATUS.ACTIVE,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "revoked");
    }
  });

  it("rejects an expired session", () => {
    const result = evaluateStaffSession({
      revokedAt: null,
      expiresAt: now,
      now,
      staffStatus: STAFF_STATUS.ACTIVE,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "expired");
    }
  });

  it("rejects a disabled user even if the session row is unexpired", () => {
    const result = evaluateStaffSession({
      revokedAt: null,
      expiresAt: later,
      now,
      staffStatus: STAFF_STATUS.DISABLED,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "disabled");
    }
  });
});
