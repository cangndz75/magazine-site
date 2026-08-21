import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MEDIA_UPLOAD_ERROR, MediaUploadError } from "@magazine/domain";
import { commitStoredObject, putStoredObjects } from "./media-upload";
import { createMemoryMediaObjectStore } from "../storage/memory";

const KEY = "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.jpg";

describe("commitStoredObject compensating delete", () => {
  it("deletes the stored object when insert fails", async () => {
    const store = createMemoryMediaObjectStore();
    await store.put({ key: KEY, body: Buffer.from("x"), contentType: "image/jpeg" });
    await assert.rejects(
      () =>
        commitStoredObject({
          storage: store,
          storageKey: KEY,
          mediaId: "5a74e0f7-75a8-4da2-a7a1-e8d0a93de772",
          byteSize: 1,
          format: "jpeg",
          insert: async () => {
            throw new Error("db unique violation");
          },
        }),
      (error: unknown) =>
        error instanceof MediaUploadError &&
        error.code === MEDIA_UPLOAD_ERROR.STORAGE_FAILED,
    );
    assert.equal(store.objects.has(KEY), false);
  });

  it("does not report success when compensating delete also fails", async () => {
    const store = createMemoryMediaObjectStore();
    await store.put({ key: KEY, body: Buffer.from("x"), contentType: "image/jpeg" });
    store.failNextDelete = new Error("delete denied");
    await assert.rejects(
      () =>
        commitStoredObject({
          storage: store,
          storageKey: KEY,
          mediaId: "5a74e0f7-75a8-4da2-a7a1-e8d0a93de772",
          byteSize: 1,
          format: "jpeg",
          insert: async () => {
            throw new Error("db unique violation");
          },
        }),
      (error: unknown) =>
        error instanceof MediaUploadError &&
        error.code === MEDIA_UPLOAD_ERROR.STORAGE_FAILED,
    );
    assert.equal(store.objects.has(KEY), true);
  });

  it("deletes derivative objects with the original when insert fails", async () => {
    const store = createMemoryMediaObjectStore();
    const thumb = "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.thumb.jpg";
    await store.put({ key: KEY, body: Buffer.from("orig"), contentType: "image/jpeg" });
    await store.put({ key: thumb, body: Buffer.from("thumb"), contentType: "image/jpeg" });
    await assert.rejects(
      () =>
        commitStoredObject({
          storage: store,
          storageKey: KEY,
          derivativeKeys: [thumb],
          mediaId: "5a74e0f7-75a8-4da2-a7a1-e8d0a93de772",
          byteSize: 1,
          format: "jpeg",
          insert: async () => {
            throw new Error("db unique violation");
          },
        }),
      (error: unknown) =>
        error instanceof MediaUploadError &&
        error.code === MEDIA_UPLOAD_ERROR.STORAGE_FAILED,
    );
    assert.equal(store.objects.has(KEY), false);
    assert.equal(store.objects.has(thumb), false);
  });

  it("cleans written derivatives when a later put fails", async () => {
    const store = createMemoryMediaObjectStore();
    const thumb = "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.thumb.jpg";
    store.failPutOfKey = thumb;
    await assert.rejects(
      () =>
        putStoredObjects({
          storage: store,
          mediaId: "5a74e0f7-75a8-4da2-a7a1-e8d0a93de772",
          byteSize: 1,
          format: "jpeg",
          objects: [
            { key: KEY, body: Buffer.from("orig"), contentType: "image/jpeg" },
            { key: thumb, body: Buffer.from("thumb"), contentType: "image/jpeg" },
          ],
        }),
      (error: unknown) =>
        error instanceof MediaUploadError &&
        error.code === MEDIA_UPLOAD_ERROR.STORAGE_FAILED,
    );
    assert.equal(store.objects.has(KEY), false);
    assert.equal(store.objects.has(thumb), false);
  });
});
