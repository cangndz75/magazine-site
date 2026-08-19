import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { MEDIA_RENDITION_MAX_EDGE } from "@magazine/domain";
import { generateImageRenditions } from "./generate-renditions";
import { normalizeUploadedImage } from "./normalize-image";

const ORIGINAL_KEY = "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.jpg";

async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 80, b: 140 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

describe("generateImageRenditions", () => {
  it("writes bounded variants without upscaling the source", async () => {
    const normalized = await normalizeUploadedImage(await jpeg(1600, 900));
    const renditions = await generateImageRenditions({
      originalStorageKey: ORIGINAL_KEY,
      normalized,
    });
    const byVariant = Object.fromEntries(
      renditions.map((item) => [item.variant, item]),
    );
    assert.equal(byVariant.thumb?.width, 320);
    assert.equal(byVariant.thumb?.height, 180);
    assert.equal(byVariant.medium?.width, 768);
    assert.equal(byVariant.medium?.height, 432);
    assert.equal(byVariant.large?.width, 1280);
    assert.equal(byVariant.large?.height, 720);
    assert.equal(
      byVariant.thumb?.storageKey,
      "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.thumb.jpg",
    );
    assert.ok((byVariant.thumb?.byteSize ?? 0) < normalized.bytes.byteLength);
  });

  it("skips variants that would upscale a small original", async () => {
    const normalized = await normalizeUploadedImage(await jpeg(400, 300));
    const renditions = await generateImageRenditions({
      originalStorageKey: ORIGINAL_KEY,
      normalized,
    });
    assert.deepEqual(
      renditions.map((item) => item.variant),
      ["thumb"],
    );
    assert.equal(renditions[0]?.width, 320);
    assert.equal(renditions[0]?.height, 240);
    assert.ok(renditions[0]!.width < MEDIA_RENDITION_MAX_EDGE.medium);
  });

  it("emits no renditions when the original already fits the thumb bound", async () => {
    const normalized = await normalizeUploadedImage(await jpeg(48, 32));
    const renditions = await generateImageRenditions({
      originalStorageKey: ORIGINAL_KEY,
      normalized,
    });
    assert.deepEqual(renditions, []);
  });
});
