import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MEDIA_RENDITION_SURFACE, publicImageProjectionLeaksInternal } from "@magazine/domain";
import { resolvePublicImageDelivery } from "./image-delivery";

const ORIGINAL_KEY = "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.jpg";
const BASE = "https://media.example.test/assets";

describe("resolvePublicImageDelivery", () => {
  it("falls back to the original URL for legacy media without renditions", () => {
    const delivery = resolvePublicImageDelivery({
      mediaPublicBaseUrl: BASE,
      originalStorageKey: ORIGINAL_KEY,
      originalWidth: 1600,
      originalHeight: 900,
      renditions: [],
      surface: MEDIA_RENDITION_SURFACE.LIBRARY_CARD,
    });
    assert.equal(delivery.url, `${BASE}/${ORIGINAL_KEY}`);
    assert.equal(delivery.width, 1600);
    assert.equal(delivery.height, 900);
    assert.equal(delivery.srcSet, null);
    assert.equal(delivery.thumbUrl, `${BASE}/${ORIGINAL_KEY}`);
    assert.equal(publicImageProjectionLeaksInternal(delivery), false);
  });

  it("selects the surface rendition and never serializes storage keys", () => {
    const delivery = resolvePublicImageDelivery({
      mediaPublicBaseUrl: BASE,
      originalStorageKey: ORIGINAL_KEY,
      originalWidth: 1600,
      originalHeight: 900,
      renditions: [
        {
          mediaId: "5a74e0f7-75a8-4da2-a7a1-e8d0a93de772",
          variant: "thumb",
          storageKey: "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.thumb.jpg",
          width: 320,
          height: 180,
          byteSize: 12,
        },
        {
          mediaId: "5a74e0f7-75a8-4da2-a7a1-e8d0a93de772",
          variant: "large",
          storageKey: "uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.large.jpg",
          width: 1280,
          height: 720,
          byteSize: 40,
        },
      ],
      surface: MEDIA_RENDITION_SURFACE.ARTICLE_HERO,
    });
    assert.equal(
      delivery.url,
      `${BASE}/uploads/2026/08/5a74e0f7-75a8-4da2-a7a1-e8d0a93de772.large.jpg`,
    );
    assert.equal(delivery.width, 1280);
    assert.equal(delivery.thumbUrl?.includes(".thumb.jpg"), true);
    assert.equal(JSON.stringify(delivery).includes("storageKey"), false);
    assert.equal(JSON.stringify(delivery).includes("byteSize"), false);
    assert.equal(publicImageProjectionLeaksInternal(delivery), false);
  });
});
