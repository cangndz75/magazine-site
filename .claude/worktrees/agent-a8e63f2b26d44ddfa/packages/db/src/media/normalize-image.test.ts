import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import {
  MEDIA_IMAGE_MAX_BYTES,
  MEDIA_UPLOAD_ERROR,
  MediaUploadError,
} from "@magazine/domain";
import { normalizeUploadedImage } from "./normalize-image";

async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 12, g: 80, b: 140 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

describe("normalizeUploadedImage", () => {
  it("extracts jpeg metadata and re-encodes without trusting the client type", async () => {
    const source = await jpeg(320, 200);
    const result = await normalizeUploadedImage(source);
    assert.equal(result.format, "jpeg");
    assert.equal(result.mimeType, "image/jpeg");
    assert.equal(result.width, 320);
    assert.equal(result.height, 200);
    assert.equal(result.contentHash.length, 64);
    assert.ok(result.bytes.byteLength > 0);
  });

  it("accepts png and webp", async () => {
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();
    const pngResult = await normalizeUploadedImage(png);
    assert.equal(pngResult.format, "png");
    assert.equal(pngResult.mimeType, "image/png");

    const webp = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 4, g: 5, b: 6 } },
    })
      .webp()
      .toBuffer();
    const webpResult = await normalizeUploadedImage(webp);
    assert.equal(webpResult.format, "webp");
  });

  it("rejects svg even when named like a jpeg", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    await assert.rejects(
      () => normalizeUploadedImage(svg),
      (error: unknown) =>
        error instanceof MediaUploadError &&
        error.code === MEDIA_UPLOAD_ERROR.UNSUPPORTED_FORMAT,
    );
  });

  it("rejects a jpeg-named spoof that is not a decoded jpeg", async () => {
    await assert.rejects(
      () => normalizeUploadedImage(Buffer.from("GIF89a not an image")),
      (error: unknown) =>
        error instanceof MediaUploadError &&
        (error.code === MEDIA_UPLOAD_ERROR.UNSUPPORTED_FORMAT ||
          error.code === MEDIA_UPLOAD_ERROR.INVALID_IMAGE),
    );
  });

  it("rejects malformed bytes", async () => {
    await assert.rejects(
      () => normalizeUploadedImage(Buffer.from([0xff, 0xd8, 0xff, 0x00])),
      (error: unknown) =>
        error instanceof MediaUploadError &&
        error.code === MEDIA_UPLOAD_ERROR.INVALID_IMAGE,
    );
  });

  it("rejects oversized payloads before decode cost dominates", async () => {
    const huge = Buffer.alloc(MEDIA_IMAGE_MAX_BYTES + 1, 0xff);
    await assert.rejects(
      () => normalizeUploadedImage(huge),
      (error: unknown) =>
        error instanceof MediaUploadError &&
        (error.code === MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE ||
          error.code === MEDIA_UPLOAD_ERROR.INVALID_IMAGE),
    );
  });

  it("applies orientation so stored width/height match the visual image", async () => {
    const landscape = await jpeg(40, 20);
    const oriented = await sharp(landscape)
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const result = await normalizeUploadedImage(oriented);
    assert.equal(result.width, 20);
    assert.equal(result.height, 40);
  });
});
