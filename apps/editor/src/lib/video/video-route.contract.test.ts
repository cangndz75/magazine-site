import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const videosRoute = path.join(
  fileURLToPath(new URL("../../app/api/videos/route.ts", import.meta.url)),
);
const videoDetailRoute = path.join(
  fileURLToPath(
    new URL("../../app/api/videos/[videoAssetId]/route.ts", import.meta.url),
  ),
);
const articleVideosRoute = path.join(
  fileURLToPath(
    new URL(
      "../../app/api/content/[contentItemId]/videos/route.ts",
      import.meta.url,
    ),
  ),
);
const videosPage = path.join(
  fileURLToPath(
    new URL("../../app/(workspace)/videos/page.tsx", import.meta.url),
  ),
);

describe("video editor route contracts", () => {
  it("keeps the video library list/create APIs on CONTENT_READ/EDIT", () => {
    const source = readFileSync(videosRoute, "utf8");
    assert.equal(source.includes("withEditorRead"), true);
    assert.equal(source.includes("withEditorWrite"), true);
    assert.equal(source.includes("CAPABILITY.CONTENT_READ"), true);
    assert.equal(source.includes("CAPABILITY.CONTENT_EDIT"), true);
    assert.equal(source.includes("listEditorVideoAssets"), true);
    assert.equal(source.includes("createEditorVideoAsset"), true);
    assert.equal(source.includes("embedUrl"), false);
    assert.equal(source.includes("iframe"), false);
    assert.equal(source.includes("storageKey"), false);
  });

  it("does not let clients supply embed URLs or poster URLs on video update", () => {
    const source = readFileSync(videoDetailRoute, "utf8");
    assert.equal(source.includes("updateEditorVideoAsset"), true);
    assert.equal(source.includes("expectedUpdatedAt"), true);
    assert.equal(source.includes("body.embedUrl"), false);
    assert.equal(source.includes("posterUrl"), false);
    assert.equal(source.includes("iframe"), false);
  });

  it("mutates article videos atomically through PUT and the content concurrency token", () => {
    const source = readFileSync(articleVideosRoute, "utf8");
    assert.equal(source.includes("withEditorWrite"), true);
    assert.equal(source.includes("CAPABILITY.CONTENT_EDIT"), true);
    assert.equal(source.includes("loadAccessibleContent"), true);
    assert.equal(source.includes("session.staffUserId"), true);
    assert.equal(source.includes("setDraftVersionVideos"), true);
    assert.equal(source.includes("expectedUpdatedAt"), true);
    assert.equal(source.includes("export async function PATCH"), false);
    assert.equal(source.includes("iframe"), false);
    assert.equal(source.includes("storageKey"), false);
  });

  it("authorizes the video library page on the server", () => {
    const source = readFileSync(videosPage, "utf8");
    assert.equal(source.includes("requireCapability(CAPABILITY.CONTENT_READ)"), true);
    assert.equal(source.includes("CAPABILITY.CONTENT_EDIT"), true);
  });
});
