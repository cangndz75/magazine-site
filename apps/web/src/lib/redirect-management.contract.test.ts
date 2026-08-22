import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("public redirect management route contract", () => {
  it("uses server-side redirect resolution only on known public dynamic routes", () => {
    for (const path of [
      "app/[slug]/page.tsx",
      "app/galeri/[slug]/page.tsx",
      "app/kimdir/[slug]/page.tsx",
    ]) {
      const source = read(path);
      assert.match(source, /resolvePublicRedirect/);
      assert.match(source, /permanentRedirect/);
    }
  });

  it("does not add an arbitrary catch-all route or Edge middleware in Pass A", () => {
    assert.equal(existsSync(new URL("../app/[[...slug]]/page.tsx", import.meta.url)), false);
    assert.equal(existsSync(new URL("../middleware.ts", import.meta.url)), false);
  });
});
