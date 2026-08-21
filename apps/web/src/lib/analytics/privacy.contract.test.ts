import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ANALYTICS_VISITOR_POLICY } from "@magazine/domain/analytics-client";

const analyticsRoot = fileURLToPath(new URL(".", import.meta.url));
const componentRoot = fileURLToPath(
  new URL("../../components/analytics", import.meta.url),
);

function listTsFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listTsFiles(full));
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("public analytics privacy contract", () => {
  it("does not persist a visitor identity in web storage", () => {
    assert.equal(ANALYTICS_VISITOR_POLICY.DURABLE_VISITOR_ID_ENABLED, false);
    const files = [
      ...listTsFiles(analyticsRoot),
      ...listTsFiles(componentRoot),
    ].filter(
      (file) =>
        !file.endsWith(".test.ts") &&
        !file.endsWith("ingest-http.ts"),
    );
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.equal(source.includes("localStorage"), false, file);
      assert.equal(source.includes("sessionStorage"), false, file);
      assert.equal(source.includes("window.location.href"), false, file);
      assert.equal(source.includes("document.cookie"), false, file);
      assert.equal(source.includes("staffUserId"), false, file);
      assert.equal(source.includes("password"), false, file);
      assert.equal(source.includes("totp"), false, file);
      assert.equal(source.includes("storageKey"), false, file);
      assert.equal(source.includes("internalNote"), false, file);
      assert.equal(source.includes("submittedUrl"), false, file);
      assert.equal(source.includes("trafficKind"), false, file);
    }
  });
});
