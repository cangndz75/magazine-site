import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractBearerToken,
  isBearerMachineAuthorized,
  machineSecretsEqual,
} from "./machine-secret";

const SECRET = "12345678901234567890123456789012";

describe("machine secret bearer comparison", () => {
  it("extracts a bearer token and rejects malformed headers", () => {
    assert.equal(extractBearerToken(`Bearer ${SECRET}`), SECRET);
    assert.equal(extractBearerToken(SECRET), "");
    assert.equal(extractBearerToken(null), "");
    assert.equal(extractBearerToken("Bearer"), "");
  });

  it("compares secrets in constant time via SHA-256 digests", () => {
    assert.equal(machineSecretsEqual(SECRET, SECRET), true);
    assert.equal(machineSecretsEqual(SECRET, `${SECRET}x`), false);
  });

  it("authorizes only a matching bearer secret", () => {
    assert.equal(isBearerMachineAuthorized(`Bearer ${SECRET}`, SECRET), true);
    assert.equal(isBearerMachineAuthorized(null, SECRET), false);
    assert.equal(isBearerMachineAuthorized(SECRET, SECRET), false);
    assert.equal(
      isBearerMachineAuthorized("Bearer wrong-secret-value-000000000", SECRET),
      false,
    );
  });
});
