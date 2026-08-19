import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MEDIA_UPLOAD_ERROR, assertSafeMediaStorageKey } from "./media-upload";
import {
  MEDIA_RENDITION_MAX_EDGE,
  MEDIA_RENDITION_SURFACE,
  MEDIA_RENDITION_VARIANT,
  buildPublicImageSrcSet,
  fitRenditionSize,
  generateMediaRenditionStorageKey,
  plannedRenditionSizes,
  publicImageProjectionLeaksInternal,
  selectResolvedImageDelivery,
} from "./media-rendition";

const ORIGINAL_KEY = "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.jpg";

describe("image rendition keys", () => {
  it("derives deterministic variant keys from the original storage key", () => {
    assert.deepEqual(generateMediaRenditionStorageKey(ORIGINAL_KEY, "thumb"), {
      ok: true,
      value: "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.thumb.jpg",
    });
    assert.deepEqual(generateMediaRenditionStorageKey(ORIGINAL_KEY, "medium"), {
      ok: true,
      value: "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.medium.jpg",
    });
    assert.deepEqual(generateMediaRenditionStorageKey(ORIGINAL_KEY, "large"), {
      ok: true,
      value: "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.large.jpg",
    });
    assert.deepEqual(
      assertSafeMediaStorageKey(
        "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.thumb.jpg",
      ),
      {
        ok: true,
        value: "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.thumb.jpg",
      },
    );
  });

  it("does not derive a rendition from an already-derived key", () => {
    assert.deepEqual(
      generateMediaRenditionStorageKey(
        "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.thumb.jpg",
        "medium",
      ),
      { ok: false, code: MEDIA_UPLOAD_ERROR.INVALID_UPLOAD },
    );
  });
});

describe("fitRenditionSize", () => {
  it("preserves aspect ratio for landscape and portrait sources", () => {
    assert.deepEqual(fitRenditionSize(1600, 900, MEDIA_RENDITION_MAX_EDGE.thumb), {
      width: 320,
      height: 180,
    });
    assert.deepEqual(fitRenditionSize(900, 1600, MEDIA_RENDITION_MAX_EDGE.medium), {
      width: 432,
      height: 768,
    });
    assert.deepEqual(fitRenditionSize(4000, 2250, MEDIA_RENDITION_MAX_EDGE.large), {
      width: 1280,
      height: 720,
    });
  });

  it("never upscales or emits a copy of the original", () => {
    assert.equal(fitRenditionSize(320, 180, 320), null);
    assert.equal(fitRenditionSize(200, 120, 320), null);
    assert.equal(fitRenditionSize(768, 432, 1280), null);
    assert.deepEqual(plannedRenditionSizes({ width: 400, height: 300 }), {
      thumb: { width: 320, height: 240 },
    });
    assert.deepEqual(plannedRenditionSizes({ width: 48, height: 32 }), {});
  });
});

describe("selectResolvedImageDelivery", () => {
  const original = {
    originalUrl: "https://cdn.example/uploads/hero.jpg",
    originalWidth: 1600,
    originalHeight: 900,
  };
  const renditions = [
    {
      variant: MEDIA_RENDITION_VARIANT.THUMB,
      url: "https://cdn.example/uploads/hero.thumb.jpg",
      width: 320,
      height: 180,
    },
    {
      variant: MEDIA_RENDITION_VARIANT.MEDIUM,
      url: "https://cdn.example/uploads/hero.medium.jpg",
      width: 768,
      height: 432,
    },
    {
      variant: MEDIA_RENDITION_VARIANT.LARGE,
      url: "https://cdn.example/uploads/hero.large.jpg",
      width: 1280,
      height: 720,
    },
  ] as const;

  it("picks the intended rendition for each surface", () => {
    assert.deepEqual(
      selectResolvedImageDelivery({
        ...original,
        renditions,
        surface: MEDIA_RENDITION_SURFACE.LIBRARY_CARD,
      }),
      {
        url: "https://cdn.example/uploads/hero.thumb.jpg",
        width: 320,
        height: 180,
      },
    );
    assert.deepEqual(
      selectResolvedImageDelivery({
        ...original,
        renditions,
        surface: MEDIA_RENDITION_SURFACE.HOMEPAGE_THUMB,
      }),
      {
        url: "https://cdn.example/uploads/hero.thumb.jpg",
        width: 320,
        height: 180,
      },
    );
    assert.deepEqual(
      selectResolvedImageDelivery({
        ...original,
        renditions,
        surface: MEDIA_RENDITION_SURFACE.HOMEPAGE_LEAD,
      }),
      {
        url: "https://cdn.example/uploads/hero.medium.jpg",
        width: 768,
        height: 432,
      },
    );
    assert.deepEqual(
      selectResolvedImageDelivery({
        ...original,
        renditions,
        surface: MEDIA_RENDITION_SURFACE.ARTICLE_HERO,
      }),
      {
        url: "https://cdn.example/uploads/hero.large.jpg",
        width: 1280,
        height: 720,
      },
    );
    assert.deepEqual(
      selectResolvedImageDelivery({
        ...original,
        renditions,
        surface: MEDIA_RENDITION_SURFACE.GALLERY_STAGE,
      }),
      {
        url: "https://cdn.example/uploads/hero.large.jpg",
        width: 1280,
        height: 720,
      },
    );
    assert.deepEqual(
      selectResolvedImageDelivery({
        ...original,
        renditions,
        surface: MEDIA_RENDITION_SURFACE.VIDEO_POSTER,
      }),
      {
        url: "https://cdn.example/uploads/hero.thumb.jpg",
        width: 320,
        height: 180,
      },
    );
  });

  it("falls back to the original URL when no renditions exist", () => {
    assert.deepEqual(
      selectResolvedImageDelivery({
        ...original,
        renditions: [],
        surface: MEDIA_RENDITION_SURFACE.LIBRARY_CARD,
      }),
      {
        url: original.originalUrl,
        width: 1600,
        height: 900,
      },
    );
  });

  it("falls back to original when the preferred variant is missing", () => {
    assert.deepEqual(
      selectResolvedImageDelivery({
        ...original,
        renditions: [renditions[0]],
        surface: MEDIA_RENDITION_SURFACE.ARTICLE_HERO,
      }),
      {
        url: original.originalUrl,
        width: 1600,
        height: 900,
      },
    );
  });
});

describe("buildPublicImageSrcSet", () => {
  it("emits width descriptors without internal storage fields", () => {
    const srcSet = buildPublicImageSrcSet({
      originalUrl: "https://cdn.example/uploads/hero.jpg",
      originalWidth: 1600,
      renditions: [
        {
          variant: "thumb",
          url: "https://cdn.example/uploads/hero.thumb.jpg",
          width: 320,
          height: 180,
        },
        {
          variant: "medium",
          url: "https://cdn.example/uploads/hero.medium.jpg",
          width: 768,
          height: 432,
        },
        {
          variant: "large",
          url: "https://cdn.example/uploads/hero.large.jpg",
          width: 1280,
          height: 720,
        },
      ],
    });
    assert.equal(
      srcSet,
      [
        "https://cdn.example/uploads/hero.thumb.jpg 320w",
        "https://cdn.example/uploads/hero.medium.jpg 768w",
        "https://cdn.example/uploads/hero.large.jpg 1280w",
        "https://cdn.example/uploads/hero.jpg 1600w",
      ].join(", "),
    );
    assert.equal(
      publicImageProjectionLeaksInternal({
        url: "https://cdn.example/uploads/hero.large.jpg",
        srcSet,
      }),
      false,
    );
  });
});
