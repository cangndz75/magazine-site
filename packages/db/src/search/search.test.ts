import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

function source(relativePath: string): string {
  return readFileSync(
    path.join(fileURLToPath(new URL(".", import.meta.url)), relativePath),
    "utf8",
  );
}

describe("postgres search provider contract", () => {
  it("enforces publication guards in public content search", () => {
    const src = source("../search/postgres-provider.ts");
    assert.match(src, /PUBLICATION_STATUS\.PUBLISHED/);
    assert.match(src, /retractedAt/);
    assert.match(src, /takedownAt/);
    assert.match(src, /publishedVersionId/);
    assert.equal(src.includes("draftVersionId"), false);
  });

  it("sanitizes search DTO before returning", () => {
    const src = source("../search/postgres-provider.ts");
    assert.match(src, /assertSafeSearchResultsDto/);
  });
});
