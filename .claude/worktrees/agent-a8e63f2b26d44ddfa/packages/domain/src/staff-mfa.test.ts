import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateSync } from "otplib";
import {
  MFA_CHALLENGE_MAX_ATTEMPTS,
  STAFF_MFA_ERROR,
  decideMfaChallengeAttempt,
  decideTotpReplay,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  mfaAuditOmitsSecrets,
  nextMfaChallengeFailure,
  normalizeRecoveryCode,
  normalizeTotpCode,
  recoveryCodesMatch,
  verifyTotpCode,
} from "./staff-mfa";

const NOW = new Date("2026-08-20T12:00:00.000Z");

describe("staff MFA domain", () => {
  it("normalizes and verifies TOTP codes", () => {
    const secret = generateTotpSecret();
    const code = generateSync({ secret, epoch: Math.floor(NOW.getTime() / 1000) });
    assert.equal(normalizeTotpCode("12345"), null);
    assert.equal(normalizeTotpCode(code), code);
    assert.deepEqual(verifyTotpCode({ secret, code, now: NOW }), {
      valid: true,
      step: Math.floor(NOW.getTime() / 1000 / 30),
    });
    assert.deepEqual(
      verifyTotpCode({ secret, code: "000000", now: NOW }),
      { valid: false },
    );
  });

  it("rejects TOTP replay within the same step window", () => {
    const step = Math.floor(NOW.getTime() / 1000 / 30);
    assert.deepEqual(
      decideTotpReplay({ candidateStep: step, lastVerifiedStep: step }),
      { ok: false, code: STAFF_MFA_ERROR.TOTP_REPLAY },
    );
    assert.deepEqual(
      decideTotpReplay({ candidateStep: step, lastVerifiedStep: step - 1 }),
      { ok: true },
    );
  });

  it("generates recovery codes with hashes only comparable via hash", () => {
    const codes = generateRecoveryCodes(3);
    assert.equal(codes.length, 3);
    for (const code of codes) {
      assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
      assert.equal(normalizeRecoveryCode(code.replace("-", "")), code);
      const hash = hashRecoveryCode(code);
      assert.equal(recoveryCodesMatch(hash, code), true);
      assert.equal(recoveryCodesMatch(hash, "ZZZZ-ZZZZ"), false);
    }
  });

  it("decides challenge attempt gates", () => {
    const expiresAt = new Date(NOW.getTime() + 60_000);
    assert.deepEqual(
      decideMfaChallengeAttempt({
        now: NOW,
        expiresAt,
        consumedAt: null,
        lockedAt: null,
        failedAttemptCount: 0,
      }),
      { ok: true },
    );
    const expired = decideMfaChallengeAttempt({
      now: NOW,
      expiresAt: new Date(NOW.getTime() - 1),
      consumedAt: null,
      lockedAt: null,
      failedAttemptCount: 0,
    });
    assert.equal(expired.ok, false);
    if (!expired.ok) {
      assert.equal(expired.code, STAFF_MFA_ERROR.CHALLENGE_EXPIRED);
    }
    const locked = nextMfaChallengeFailure({
      failedAttemptCount: MFA_CHALLENGE_MAX_ATTEMPTS - 1,
      now: NOW,
    });
    assert.ok(locked.lockedAt);
  });

  it("rejects secret-bearing audit change sets", () => {
    assert.equal(mfaAuditOmitsSecrets({ factorId: "abc" }), true);
    assert.equal(mfaAuditOmitsSecrets({ secret: "nope" }), false);
    assert.equal(mfaAuditOmitsSecrets({ nested: { recoveryCode: "x" } }), false);
  });
});
