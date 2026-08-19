import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { MEDIA_UPLOAD_ERROR, MediaUploadError } from "@magazine/domain";
import { createLocalMediaObjectStore } from "./local";
import { createMemoryMediaObjectStore } from "./memory";

const KEY = "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.jpg";

describe("media object stores", () => {
  it("puts and deletes in memory", async () => {
    const store = createMemoryMediaObjectStore();
    await store.put({ key: KEY, body: Buffer.from("abc"), contentType: "image/jpeg" });
    assert.equal(store.objects.get(KEY)?.body.toString(), "abc");
    await store.delete(KEY);
    assert.equal(store.objects.has(KEY), false);
  });

  it("surfaces put failures", async () => {
    const store = createMemoryMediaObjectStore();
    store.failNextPut = new Error("disk full");
    await assert.rejects(() =>
      store.put({ key: KEY, body: Buffer.from("abc"), contentType: "image/jpeg" }),
    );
  });

  it("writes only safe generated keys under the local root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "magazine-media-"));
    try {
      const store = createLocalMediaObjectStore(root);
      await store.put({
        key: KEY,
        body: Buffer.from("jpeg-bytes"),
        contentType: "image/jpeg",
      });
      const written = await readFile(path.join(root, ...KEY.split("/")), "utf8");
      assert.equal(written, "jpeg-bytes");
      await assert.rejects(
        () =>
          store.put({
            key: "../secret.jpg",
            body: Buffer.from("nope"),
            contentType: "image/jpeg",
          }),
        (error: unknown) =>
          error instanceof MediaUploadError &&
          error.code === MEDIA_UPLOAD_ERROR.INVALID_UPLOAD,
      );
      await store.delete(KEY);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
