import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MfaCryptoError,
  decryptMfaSecret,
  encryptMfaSecret,
  parseMfaEncryptionKey,
} from "./staff-mfa-crypto";

const TEST_KEY = Buffer.alloc(32, 0x2a);

describe("staff MFA crypto", () => {
  it("parses a 32-byte base64url encryption key", () => {
    const parsed = parseMfaEncryptionKey(TEST_KEY.toString("base64url"));
    assert.equal(parsed.equals(TEST_KEY), true);
  });

  it("rejects missing and invalid keys", () => {
    assert.throws(() => parseMfaEncryptionKey(""), MfaCryptoError);
    assert.throws(() => parseMfaEncryptionKey("too-short"), MfaCryptoError);
  });

  it("round-trips secret encryption and rejects tampering", () => {
    const ciphertext = encryptMfaSecret("JBSWY3DPEHPK3PXP", TEST_KEY);
    assert.equal(ciphertext.startsWith("1."), true);
    assert.equal(ciphertext.includes("JBSWY3DPEHPK3PXP"), false);

    const plaintext = decryptMfaSecret(ciphertext, TEST_KEY);
    assert.equal(plaintext, "JBSWY3DPEHPK3PXP");

    const parts = ciphertext.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2]!.slice(0, -2)}AA`;
    assert.throws(() => decryptMfaSecret(tampered, TEST_KEY), MfaCryptoError);

    const wrongKey = Buffer.alloc(32, 0x11);
    assert.throws(() => decryptMfaSecret(ciphertext, wrongKey), MfaCryptoError);
  });
});
