import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  currentGalleryIndex,
  galleryItemsIdentity,
  stepGalleryIndex,
} from "./public-article-gallery-state";

describe("public article gallery state", () => {
  it("treats an empty gallery as a safe no-op identity", () => {
    assert.equal(galleryItemsIdentity([]), "");
    assert.equal(currentGalleryIndex(0, 0), 0);
    assert.equal(stepGalleryIndex(0, 0, 1), 0);
    assert.equal(stepGalleryIndex(4, 0, -1), 0);
  });

  it("keeps a one-item gallery on the first item", () => {
    assert.equal(currentGalleryIndex(0, 1), 0);
    assert.equal(stepGalleryIndex(0, 1, 1), 0);
    assert.equal(stepGalleryIndex(0, 1, -1), 0);
  });

  it("starts at the first item and steps next/previous within bounds", () => {
    assert.equal(currentGalleryIndex(0, 3), 0);
    assert.equal(stepGalleryIndex(0, 3, 1), 1);
    assert.equal(stepGalleryIndex(1, 3, 1), 2);
    assert.equal(stepGalleryIndex(2, 3, -1), 1);
  });

  it("wraps at the first and last items", () => {
    assert.equal(stepGalleryIndex(0, 3, -1), 2);
    assert.equal(stepGalleryIndex(2, 3, 1), 0);
  });

  it("cannot keep a stale index after the gallery identity changes", () => {
    const first = galleryItemsIdentity([
      { mediaId: "a" },
      { mediaId: "b" },
      { mediaId: "c" },
    ]);
    const second = galleryItemsIdentity([{ mediaId: "d" }]);
    assert.notEqual(first, second);
    assert.equal(currentGalleryIndex(2, 1), 0);
    assert.equal(stepGalleryIndex(2, 1, 1), 0);
  });
});
