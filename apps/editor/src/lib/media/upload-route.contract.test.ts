import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const uploadRoute = path.join(
  fileURLToPath(new URL("../../app/api/media/upload/route.ts", import.meta.url)),
);

describe("media upload route contract", () => {
  it("uses the editor write perimeter and CONTENT_EDIT", () => {
    const source = readFileSync(uploadRoute, "utf8");
    assert.equal(source.includes("withEditorMutation"), true);
    assert.equal(source.includes("CAPABILITY.CONTENT_EDIT"), true);
    assert.equal(source.includes("readMediaUploadFile"), true);
    assert.equal(source.includes("uploadEditorImage"), true);
    assert.equal(source.includes("readEditorJsonBody"), false);
    assert.equal(source.includes("NEXT_PUBLIC_"), false);
    assert.equal(source.includes("storageKey"), false);
    assert.equal(source.includes("MEDIA_S3_SECRET"), false);
    assert.equal(source.includes("MEDIA_LOCAL_ROOT"), false);
  });
});
