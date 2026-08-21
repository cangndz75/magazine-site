import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRecoveryCodesDownloadFilename,
  containsSensitiveMfaMaterial,
  formatRecoveryCodesForCopy,
  SENSITIVE_MFA_STORAGE_KEYS,
} from "./mfa-presentation";

describe("MFA security boundary helpers", () => {
  it("never encodes recovery codes into URL-like strings", () => {
    const codes = ["ABCD-EFGH", "WXYZ-2345"];
    const copy = formatRecoveryCodesForCopy(codes);
    assert.equal(copy.includes("?"), false);
    assert.equal(copy.includes("#"), false);
    const filename = buildRecoveryCodesDownloadFilename();
    assert.equal(filename.includes("ABCD"), false);
  });

  it("lists sensitive storage keys that must not be used for MFA material", () => {
    assert.equal(SENSITIVE_MFA_STORAGE_KEYS.includes("recoveryCodes"), true);
    assert.equal(SENSITIVE_MFA_STORAGE_KEYS.includes("otpauthUri"), true);
    assert.equal(SENSITIVE_MFA_STORAGE_KEYS.includes("challengeToken"), true);
  });

  it("flags otpauth URIs as sensitive", () => {
    assert.equal(
      containsSensitiveMfaMaterial("otpauth://totp/Editor:user?secret=ABC"),
      true,
    );
  });
});
