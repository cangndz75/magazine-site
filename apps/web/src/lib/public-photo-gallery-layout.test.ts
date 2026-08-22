import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PublicArticleGalleryItem } from "@magazine/domain";
import {
  buildPhotoGalleryLayout,
  canPairPhotoGalleryItems,
} from "./public-photo-gallery-layout";

function item(
  mediaId: string,
  width: number,
  height: number,
): PublicArticleGalleryItem {
  return {
    mediaId,
    url: `https://cdn.example/${mediaId}.jpg`,
    width,
    height,
    altText: null,
    caption: null,
    credit: null,
    thumbUrl: `https://cdn.example/${mediaId}.jpg`,
    srcSet: null,
    sizes: null,
  };
}

describe("buildPhotoGalleryLayout", () => {
  it("keeps portrait frames single and pairs consecutive landscape frames", () => {
    const blocks = buildPhotoGalleryLayout([
      item("a", 1600, 900),
      item("b", 1400, 900),
      item("c", 900, 1400),
      item("d", 1200, 800),
      item("e", 1280, 720),
    ]);

    assert.deepEqual(
      blocks.map((block) => block.type),
      ["pair", "single", "pair"],
    );
    assert.deepEqual(blocks[0]?.type === "pair" ? blocks[0].indices : null, [0, 1]);
    assert.equal(blocks[1]?.type === "single" ? blocks[1].index : null, 2);
    assert.deepEqual(blocks[2]?.type === "pair" ? blocks[2].indices : null, [3, 4]);
  });

  it("never drops items from the ordered layout", () => {
    const items = [
      item("1", 1200, 800),
      item("2", 900, 1200),
      item("3", 1200, 800),
      item("4", 1200, 800),
    ];
    const blocks = buildPhotoGalleryLayout(items);
    const covered = blocks.flatMap((block) =>
      block.type === "pair" ? block.indices : [block.index],
    );
    assert.deepEqual(covered, [0, 1, 2, 3]);
  });
});

describe("canPairPhotoGalleryItems", () => {
  it("requires both frames to be landscape", () => {
    assert.equal(canPairPhotoGalleryItems(item("a", 1200, 800), item("b", 1200, 800)), true);
    assert.equal(canPairPhotoGalleryItems(item("a", 900, 1200), item("b", 1200, 800)), false);
  });
});
