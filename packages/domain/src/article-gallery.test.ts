import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MEDIA_TYPE } from "./media-type";
import { MEDIA_RIGHTS_TEXT_MAX } from "./media-rights";
import { PUBLISHING_ERROR } from "./publishing/errors";
import {
  ARTICLE_HERO_ALT_TEXT_MAX,
  canonicalizeHeroAltText,
  canonicalizeHeroCredit,
} from "./article-hero";
import {
  ARTICLE_GALLERY_CAPTION_MAX,
  ARTICLE_GALLERY_MAX_ITEMS,
  assertGalleryAssignableMediaType,
  canonicalizeDraftGalleryItems,
  canonicalizeGalleryCaption,
  toPublicArticleGalleryItem,
} from "./article-gallery";

describe("canonicalizeDraftGalleryItems", () => {
  it("assigns dense 0-based sort order from the submitted array", () => {
    const result = canonicalizeDraftGalleryItems([
      { mediaId: "m-b", caption: " Second ", altText: "b", credit: "B" },
      { mediaId: "m-a", caption: "First", altText: "a", credit: null },
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(result.value, [
      {
        mediaId: "m-b",
        sortOrder: 0,
        altText: "b",
        credit: "B",
        caption: "Second",
      },
      {
        mediaId: "m-a",
        sortOrder: 1,
        altText: "a",
        credit: null,
        caption: "First",
      },
    ]);
  });

  it("rejects duplicate Media assets in one gallery", () => {
    const result = canonicalizeDraftGalleryItems([
      { mediaId: "m1" },
      { mediaId: "m1" },
    ]);
    assert.deepEqual(result, {
      ok: false,
      code: PUBLISHING_ERROR.DUPLICATE_RELATION,
    });
  });

  it("rejects an oversize gallery", () => {
    const items = Array.from({ length: ARTICLE_GALLERY_MAX_ITEMS + 1 }, (_, index) => ({
      mediaId: `m-${index}`,
    }));
    assert.deepEqual(canonicalizeDraftGalleryItems(items), {
      ok: false,
      code: PUBLISHING_ERROR.INVALID_RELATION,
    });
  });

  it("allows an empty gallery", () => {
    assert.deepEqual(canonicalizeDraftGalleryItems([]), { ok: true, value: [] });
  });
});

describe("gallery field bounds", () => {
  it("bounds alt, caption, and credit like HERO public credit", () => {
    assert.deepEqual(canonicalizeHeroAltText("x".repeat(ARTICLE_HERO_ALT_TEXT_MAX + 1)), {
      ok: false,
      code: PUBLISHING_ERROR.INVALID_RELATION,
    });
    assert.deepEqual(
      canonicalizeGalleryCaption("x".repeat(ARTICLE_GALLERY_CAPTION_MAX + 1)),
      { ok: false, code: PUBLISHING_ERROR.INVALID_RELATION },
    );
    assert.deepEqual(canonicalizeHeroCredit("x".repeat(MEDIA_RIGHTS_TEXT_MAX.CREDIT + 1)), {
      ok: false,
      code: PUBLISHING_ERROR.INVALID_RELATION,
    });
    assert.deepEqual(canonicalizeGalleryCaption("  "), { ok: true, value: null });
    assert.deepEqual(canonicalizeGalleryCaption(""), { ok: true, value: null });
  });

  it("rejects VIDEO as a gallery image", () => {
    assert.deepEqual(assertGalleryAssignableMediaType(MEDIA_TYPE.VIDEO), {
      ok: false,
      code: PUBLISHING_ERROR.INVALID_GALLERY_MEDIA,
    });
    assert.deepEqual(assertGalleryAssignableMediaType(MEDIA_TYPE.IMAGE), {
      ok: true,
      value: true,
    });
  });
});

describe("toPublicArticleGalleryItem", () => {
  it("projects only public-safe fields and falls back to creditLine", () => {
    const item = toPublicArticleGalleryItem({
      mediaId: "media-1",
      mediaType: MEDIA_TYPE.IMAGE,
      publicUrl: " https://media.example.test/a.jpg ",
      width: 1600,
      height: 900,
      altText: " Crowd ",
      caption: " Opening night ",
      attachmentCredit: null,
      creditLine: " Desk Photo ",
    });
    assert.deepEqual(item, {
      mediaId: "media-1",
      url: "https://media.example.test/a.jpg",
      width: 1600,
      height: 900,
      altText: "Crowd",
      caption: "Opening night",
      credit: "Desk Photo",
    });
    const serialized = JSON.stringify(item);
    assert.equal(serialized.includes("storageKey"), false);
    assert.equal(serialized.includes("licenseNote"), false);
    assert.equal(serialized.includes("rightsHolder"), false);
  });

  it("returns null for VIDEO, missing URL, or unusable image", () => {
    assert.equal(
      toPublicArticleGalleryItem({
        mediaId: "v1",
        mediaType: MEDIA_TYPE.VIDEO,
        publicUrl: "https://media.example.test/clip.mp4",
        width: 1920,
        height: 1080,
        altText: null,
        caption: null,
        attachmentCredit: null,
        creditLine: null,
      }),
      null,
    );
    assert.equal(
      toPublicArticleGalleryItem({
        mediaId: "m1",
        mediaType: MEDIA_TYPE.IMAGE,
        publicUrl: null,
        width: 800,
        height: 600,
        altText: "alt",
        caption: "cap",
        attachmentCredit: null,
        creditLine: null,
      }),
      null,
    );
  });
});
