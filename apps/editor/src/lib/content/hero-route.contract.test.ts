import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const heroRoute = path.join(
  fileURLToPath(
    new URL("../../app/api/content/[contentItemId]/hero/route.ts", import.meta.url),
  ),
);

describe("article hero route contract", () => {
  it("uses the editor write perimeter and CONTENT_EDIT", () => {
    const source = readFileSync(heroRoute, "utf8");
    assert.equal(source.includes("withEditorWrite"), true);
    assert.equal(source.includes("CAPABILITY.CONTENT_EDIT"), true);
    assert.equal(source.includes("loadAccessibleContent"), true);
    assert.equal(source.includes("session.staffUserId"), true);
    assert.equal(source.includes("parseDraftHeroBody"), true);
    assert.equal(source.includes("setDraftVersionHero"), true);
    assert.equal(source.includes("removeDraftVersionHero"), true);
    assert.equal(source.includes("storageKey"), false);
    assert.equal(source.includes("licenseNote"), false);
    assert.equal(source.includes("NEXT_PUBLIC_"), false);
    assert.equal(source.includes("MEDIA_S3_SECRET"), false);
    assert.equal(source.includes("MEDIA_LOCAL_ROOT"), false);
  });
});
