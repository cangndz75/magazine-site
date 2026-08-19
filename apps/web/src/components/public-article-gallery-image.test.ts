import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLIC_GALLERY_IMAGE_SIZES } from "@magazine/domain";
import type { PublicArticleGalleryItem } from "@magazine/domain";

function galleryStageImg(item: PublicArticleGalleryItem) {
  return {
    src: item.url,
    srcSet: item.srcSet ?? undefined,
    sizes: item.sizes ?? undefined,
    thumbSrc: item.thumbUrl ?? item.url,
  };
}

describe("public gallery responsive attrs", () => {
  it("uses srcset for rendition-backed gallery items", () => {
    const item: PublicArticleGalleryItem = {
      mediaId: "media-1",
      url: "https://cdn.example/hero.large.jpg",
      width: 1280,
      height: 720,
      altText: "Crowd",
      caption: null,
      credit: null,
      thumbUrl: "https://cdn.example/hero.thumb.jpg",
      srcSet:
        "https://cdn.example/hero.thumb.jpg 320w, https://cdn.example/hero.medium.jpg 768w, https://cdn.example/hero.large.jpg 1280w",
      sizes: PUBLIC_GALLERY_IMAGE_SIZES,
    };
    assert.deepEqual(galleryStageImg(item), {
      src: "https://cdn.example/hero.large.jpg",
      srcSet: item.srcSet ?? undefined,
      sizes: PUBLIC_GALLERY_IMAGE_SIZES,
      thumbSrc: "https://cdn.example/hero.thumb.jpg",
    });
  });

  it("falls back to the original URL when renditions are absent", () => {
    const item: PublicArticleGalleryItem = {
      mediaId: "media-legacy",
      url: "https://cdn.example/hero.jpg",
      width: 1600,
      height: 900,
      altText: null,
      caption: null,
      credit: null,
      thumbUrl: "https://cdn.example/hero.jpg",
      srcSet: null,
      sizes: null,
    };
    assert.deepEqual(galleryStageImg(item), {
      src: "https://cdn.example/hero.jpg",
      srcSet: undefined,
      sizes: undefined,
      thumbSrc: "https://cdn.example/hero.jpg",
    });
  });
});
