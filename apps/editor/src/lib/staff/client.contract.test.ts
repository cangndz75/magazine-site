import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const clientPath = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "client.ts",
);

describe("staff admin client contracts", () => {
  it("sends expectedUpdatedAt on role mutations", () => {
    const source = readFileSync(clientPath, "utf8");
    assert.match(source, /expectedUpdatedAt: input\.expectedUpdatedAt/);
    assert.equal(source.includes("body.currentSessionId"), false);
    assert.equal(source.includes("capabilities"), false);
  });

  it("uses includeCurrentSession for revoke-all without client session id", () => {
    const source = readFileSync(clientPath, "utf8");
    assert.match(source, /includeCurrentSession: input\.includeCurrentSession/);
    assert.equal(source.includes("currentSessionId"), false);
  });

  it("does not send replacement passwords for reset-required action", () => {
    const source = readFileSync(clientPath, "utf8");
    assert.equal(source.includes("newPassword"), false);
    assert.equal(source.includes("password:"), false);
  });
});
