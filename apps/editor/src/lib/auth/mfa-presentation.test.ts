import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAFF_MFA_ERROR } from "@magazine/domain";
import {
  buildRecoveryCodesDownloadFilename,
  containsSensitiveMfaMaterial,
  formatRecoveryCodesForCopy,
  normalizeClientRecoveryInput,
  normalizeClientTotpInput,
  presentMfaEnrollmentFailure,
  presentMfaLoginFailure,
} from "./mfa-presentation";

describe("MFA presentation", () => {
  it("maps login challenge failures to Turkish messages", () => {
    const invalid = presentMfaLoginFailure(STAFF_MFA_ERROR.INVALID_TOTP_CODE);
    assert.equal(invalid.recoverToPasswordLogin, false);
    assert.match(invalid.message, /geçersiz/i);

    const expired = presentMfaLoginFailure(STAFF_MFA_ERROR.CHALLENGE_EXPIRED);
    assert.equal(expired.recoverToPasswordLogin, true);
    assert.match(expired.message, /parola/i);

    const locked = presentMfaLoginFailure(STAFF_MFA_ERROR.CHALLENGE_LOCKED);
    assert.equal(locked.recoverToPasswordLogin, true);
  });

  it("maps enrollment failures to Turkish messages", () => {
    assert.match(
      presentMfaEnrollmentFailure(STAFF_MFA_ERROR.INVALID_TOTP_CODE),
      /Authenticator/i,
    );
    assert.match(
      presentMfaEnrollmentFailure(STAFF_MFA_ERROR.STEP_UP_REQUIRED),
      /parola/i,
    );
  });

  it("normalizes client TOTP and recovery inputs", () => {
    assert.equal(normalizeClientTotpInput("123 456"), "123456");
    assert.equal(normalizeClientTotpInput("12345"), null);
    assert.equal(normalizeClientRecoveryInput("abcd-efgh"), "ABCD-EFGH");
    assert.equal(normalizeClientRecoveryInput("nope"), null);
  });

  it("formats recovery codes for copy and download without URL encoding", () => {
    const codes = ["ABCD-EFGH", "WXYZ-2345"];
    assert.equal(formatRecoveryCodesForCopy(codes), "ABCD-EFGH\nWXYZ-2345");
    assert.match(buildRecoveryCodesDownloadFilename(), /^magazine-editor-kurtarma-kodlari-/);
  });

  it("detects sensitive MFA material patterns", () => {
    assert.equal(containsSensitiveMfaMaterial("otpauth://totp/test"), true);
    assert.equal(containsSensitiveMfaMaterial("localStorage.setItem('mfaSecret')"), true);
    assert.equal(containsSensitiveMfaMaterial("Güvenlik ayarları"), false);
  });
});
