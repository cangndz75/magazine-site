import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_GALLERY_NAVIGATION_METHOD,
  galleryAnalyticsEmissions,
} from "@magazine/domain/analytics-client";

const root = fileURLToPath(new URL("../..", import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const gallerySources = [
  "components/public-article-gallery.tsx",
  "components/public-photo-gallery-story.tsx",
];

const MEDIA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEDIA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("public gallery analytics", () => {
  it("does not open the gallery from the initial render path", () => {
    for (const rel of gallerySources) {
      const source = read(rel);
      assert.equal(source.includes("galleryAnalyticsEmissions"), true);
      assert.equal(
        source.includes("useEffect(() => {\n    publicAnalytics.trackGalleryOpen"),
        false,
      );
    }
    assert.equal(read("components/public-article-gallery.tsx").includes("applyUserNavigation"), true);
    assert.equal(read("components/public-photo-gallery-story.tsx").includes("applyNavigation"), true);
  });

  it("records OPEN then NAVIGATE then IMAGE_VIEW for next", () => {
    const result = galleryAnalyticsEmissions({
      opened: false,
      items: [{ mediaId: MEDIA_A }, { mediaId: MEDIA_B }],
      action: {
        method: ANALYTICS_GALLERY_NAVIGATION_METHOD.NEXT,
        fromIndex: 0,
        toIndex: 1,
      },
    });
    assert.deepEqual(
      result.emissions.map((event) => event.eventName),
      [
        ANALYTICS_EVENT_NAME.GALLERY_OPEN,
        ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE,
        ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW,
      ],
    );
    assert.equal(result.emissions[2]?.mediaId, MEDIA_B);
    assert.equal(result.emissions[2]?.galleryPosition, 1);
  });

  it("uses THUMB and KEYBOARD methods without repeating OPEN", () => {
    const thumb = galleryAnalyticsEmissions({
      opened: true,
      items: [{ mediaId: MEDIA_A }, { mediaId: MEDIA_B }],
      action: {
        method: ANALYTICS_GALLERY_NAVIGATION_METHOD.THUMB,
        fromIndex: 0,
        toIndex: 1,
      },
    });
    assert.equal(thumb.emissions[0]?.eventName, ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE);
    if (thumb.emissions[0]?.eventName === ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE) {
      assert.equal(thumb.emissions[0].navigationMethod, ANALYTICS_GALLERY_NAVIGATION_METHOD.THUMB);
    }

    const keyboard = galleryAnalyticsEmissions({
      opened: true,
      items: [{ mediaId: MEDIA_A }, { mediaId: MEDIA_B }],
      action: {
        method: ANALYTICS_GALLERY_NAVIGATION_METHOD.KEYBOARD,
        fromIndex: 1,
        toIndex: 0,
      },
    });
    if (keyboard.emissions[0]?.eventName === ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE) {
      assert.equal(
        keyboard.emissions[0].navigationMethod,
        ANALYTICS_GALLERY_NAVIGATION_METHOD.KEYBOARD,
      );
    }
  });

  it("does not put storageKey into gallery instrumentation", () => {
    for (const rel of gallerySources) {
      assert.equal(read(rel).includes("storageKey"), false);
    }
  });
});
