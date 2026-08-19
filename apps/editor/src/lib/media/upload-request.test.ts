import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MEDIA_UPLOAD_ERROR,
  MEDIA_UPLOAD_MAX_REQUEST_BYTES,
  MediaUploadError,
} from "@magazine/domain";
import { readMediaUploadFile } from "./upload-request";

function multipartRequest(parts: File[], extra?: { contentLength?: string }): Request {
  const form = new FormData();
  for (const part of parts) {
    form.append("file", part);
  }
  const headers: Record<string, string> = {};
  if (extra?.contentLength) {
    headers["content-length"] = extra.contentLength;
  }
  return new Request("https://editor.example/api/media/upload", {
    method: "POST",
    headers,
    body: form,
  });
}

describe("readMediaUploadFile", () => {
  it("reads a single file part", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "hero.jpg", {
      type: "application/octet-stream",
    });
    const parsed = await readMediaUploadFile(multipartRequest([file]));
    assert.equal(parsed.originalFilename, "hero.jpg");
    assert.deepEqual([...parsed.bytes], [1, 2, 3]);
  });

  it("rejects missing, multiple, empty, and oversized files", async () => {
    await assert.rejects(
      () =>
        readMediaUploadFile(
          new Request("https://editor.example/api/media/upload", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          }),
        ),
      (error: unknown) =>
        error instanceof MediaUploadError &&
        error.code === MEDIA_UPLOAD_ERROR.INVALID_UPLOAD,
    );

    const emptyForm = new FormData();
    await assert.rejects(
      () =>
        readMediaUploadFile(
          new Request("https://editor.example/api/media/upload", {
            method: "POST",
            body: emptyForm,
          }),
        ),
      (error: unknown) =>
        error instanceof MediaUploadError && error.code === MEDIA_UPLOAD_ERROR.EMPTY_FILE,
    );

    const a = new File([new Uint8Array([1])], "a.jpg");
    const b = new File([new Uint8Array([2])], "b.jpg");
    await assert.rejects(
      () => readMediaUploadFile(multipartRequest([a, b])),
      (error: unknown) =>
        error instanceof MediaUploadError &&
        error.code === MEDIA_UPLOAD_ERROR.INVALID_UPLOAD,
    );

    await assert.rejects(
      () =>
        readMediaUploadFile(
          multipartRequest([a], {
            contentLength: String(MEDIA_UPLOAD_MAX_REQUEST_BYTES + 1),
          }),
        ),
      (error: unknown) =>
        error instanceof MediaUploadError &&
        error.code === MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE,
    );
  });
});
