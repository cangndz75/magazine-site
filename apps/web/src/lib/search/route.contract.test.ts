import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "../..");

describe("public search route contract", () => {
  it("exposes /arama without querying content tables from the page", () => {
    assert.equal(existsSync(path.join(root, "app/arama/page.tsx")), true);
    const page = readFileSync(path.join(root, "app/arama/page.tsx"), "utf8");
    assert.match(page, /getPublicSearchResults/);
    assert.equal(page.includes("contentItems"), false);
    assert.equal(page.includes("content_versions"), false);
  });

  it("marks search pages as noindex", () => {
    const page = readFileSync(path.join(root, "app/arama/page.tsx"), "utf8");
    assert.match(page, /index:\s*false/);
  });

  it("links header search affordance to /arama", () => {
    const header = readFileSync(
      path.join(root, "components/public-site-header.tsx"),
      "utf8",
    );
    assert.match(header, /href="\/arama"/);
    assert.equal(header.includes("yakında"), false);
  });
});
