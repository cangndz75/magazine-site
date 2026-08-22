import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dbRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(dbRoot, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("redirect management DB contract", () => {
  it("keeps the redirect migration after feature controls", () => {
    const journal = JSON.parse(
      read("packages/db/drizzle/meta/_journal.json"),
    ) as { entries: { idx: number; tag: string }[] };
    const tags = journal.entries.map((entry) => entry.tag);
    const featureControls = tags.indexOf("0025_feature-controls");
    const redirectManagement = tags.indexOf("0026_redirect-management");
    assert.notEqual(featureControls, -1);
    assert.notEqual(redirectManagement, -1);
    assert.equal(featureControls < redirectManagement, true);
    assert.equal(journal.entries[redirectManagement]?.idx, 25);
  });

  it("exposes one authoritative redirect service and bounded read queries", () => {
    const pkg = read("packages/db/package.json");
    const service = read("packages/db/src/redirects.ts");
    assert.match(pkg, /"\.\/redirects": "\.\/src\/redirects\.ts"/);
    assert.match(service, /export async function resolvePublicRedirect/);
    assert.match(service, /export async function listRedirectRules/);
    assert.equal(/\.select\(\)/.test(service), false);
    assert.match(service, /limit\(limit \+ 1\)/);
  });
});
