import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAFF_ROLE } from "./staff-role";
import {
  MEDIA_IMAGE_MAX_BYTES,
  MEDIA_IMAGE_MAX_PIXELS,
  MEDIA_UPLOAD_ERROR,
  assertDecodedImageConstraints,
  assertSafeMediaStorageKey,
  authorizeMediaUpload,
  canonicalizeOriginalFilename,
  generateMediaStorageKey,
} from "./media-upload";

describe("authorizeMediaUpload", () => {
  it("requires CONTENT_EDIT", () => {
    assert.deepEqual(authorizeMediaUpload({ roles: [STAFF_ROLE.AUTHOR] }), {
      ok: true,
      value: true,
    });
    assert.deepEqual(authorizeMediaUpload({ roles: [] }), {
      ok: false,
      code: MEDIA_UPLOAD_ERROR.FORBIDDEN,
    });
  });
});

describe("assertDecodedImageConstraints", () => {
  it("accepts a valid jpeg within limits", () => {
    assert.deepEqual(
      assertDecodedImageConstraints({
        format: "jpeg",
        width: 1600,
        height: 900,
        byteSize: 2048,
      }),
      { ok: true, value: { format: "jpeg", width: 1600, height: 900 } },
    );
  });

  it("rejects empty, oversized, spoofed, malformed, and pathological dimensions", () => {
    assert.equal(
      assertDecodedImageConstraints({
        format: "jpeg",
        width: 100,
        height: 100,
        byteSize: 0,
      }).ok,
      false,
    );
    assert.deepEqual(
      assertDecodedImageConstraints({
        format: "jpeg",
        width: 100,
        height: 100,
        byteSize: MEDIA_IMAGE_MAX_BYTES + 1,
      }),
      { ok: false, code: MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE },
    );
    assert.deepEqual(
      assertDecodedImageConstraints({
        format: "svg",
        width: 100,
        height: 100,
        byteSize: 100,
      }),
      { ok: false, code: MEDIA_UPLOAD_ERROR.UNSUPPORTED_FORMAT },
    );
    assert.deepEqual(
      assertDecodedImageConstraints({
        format: "jpeg",
        width: undefined,
        height: 100,
        byteSize: 100,
      }),
      { ok: false, code: MEDIA_UPLOAD_ERROR.INVALID_IMAGE },
    );
    assert.deepEqual(
      assertDecodedImageConstraints({
        format: "png",
        width: 8001,
        height: 10,
        byteSize: 100,
      }),
      { ok: false, code: MEDIA_UPLOAD_ERROR.DIMENSIONS_EXCEEDED },
    );
    assert.deepEqual(
      assertDecodedImageConstraints({
        format: "png",
        width: 6001,
        height: 6001,
        byteSize: 100,
      }),
      { ok: false, code: MEDIA_UPLOAD_ERROR.DIMENSIONS_EXCEEDED },
    );
    assert.ok(6001 * 6001 > MEDIA_IMAGE_MAX_PIXELS);
  });
});

describe("canonicalizeOriginalFilename", () => {
  it("uses only the basename and never a filesystem path", () => {
    assert.equal(
      canonicalizeOriginalFilename("..\\..\\etc\\passwd.jpg", "jpeg"),
      "passwd.jpg",
    );
    assert.equal(
      canonicalizeOriginalFilename("/tmp/nested/hero.png", "png"),
      "hero.png",
    );
    assert.equal(canonicalizeOriginalFilename("...", "webp"), "image.webp");
    assert.equal(canonicalizeOriginalFilename("", "avif"), "image.avif");
  });
});

describe("generateMediaStorageKey", () => {
  it("builds a server-side key from id and decoded format, not the user filename", () => {
    const id = "5a74e0f7-75a8-4da2-a7a1-e8d0a93de772";
    assert.equal(
      generateMediaStorageKey({
        now: new Date("2026-08-19T12:00:00.000Z"),
        id,
        format: "jpeg",
      }),
      `uploads/2026/08/${id}.jpg`,
    );
    assert.deepEqual(
      assertSafeMediaStorageKey(`uploads/2026/08/${id}.jpg`),
      { ok: true, value: `uploads/2026/08/${id}.jpg` },
    );
  });

  it("rejects path traversal and user-controlled keys", () => {
    assert.deepEqual(assertSafeMediaStorageKey("../secret.jpg"), {
      ok: false,
      code: MEDIA_UPLOAD_ERROR.INVALID_UPLOAD,
    });
    assert.deepEqual(assertSafeMediaStorageKey("uploads/2026/08/../x.jpg"), {
      ok: false,
      code: MEDIA_UPLOAD_ERROR.INVALID_UPLOAD,
    });
    assert.deepEqual(
      assertSafeMediaStorageKey("uploads/2026/08/not-a-uuid.jpg"),
      { ok: false, code: MEDIA_UPLOAD_ERROR.INVALID_UPLOAD },
    );
  });
});
