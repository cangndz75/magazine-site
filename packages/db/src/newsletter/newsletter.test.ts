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

describe("newsletter audience DB contract", () => {
  it("keeps newsletter migration after redirect management", () => {
    const journal = JSON.parse(
      read("packages/db/drizzle/meta/_journal.json"),
    ) as { entries: { idx: number; tag: string }[] };
    const tags = journal.entries.map((entry) => entry.tag);
    const redirect = tags.indexOf("0026_redirect-management");
    const newsletter = tags.indexOf("0027_newsletter-audience-foundation");
    assert.notEqual(redirect, -1);
    assert.notEqual(newsletter, -1);
    assert.equal(redirect < newsletter, true);
    assert.equal(journal.entries[newsletter]?.idx, 26);
  });

  it("keeps tokens out of public API and uses bounded newsletter reads", () => {
    const service = read("packages/db/src/newsletter.ts");
    assert.match(service, /hashNewsletterToken/);
    assert.match(service, /confirmationTokenHash/);
    assert.match(service, /limit\(limit \+ 1\)/);
    assert.equal(/\.select\(\)/.test(service), false);
  });
});
