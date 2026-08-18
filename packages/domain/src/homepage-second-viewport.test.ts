import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOMEPAGE_GALLERY_DATA_SOURCE_NOT_YET_AVAILABLE,
  HOMEPAGE_VIDEO_DATA_SOURCE_NOT_YET_AVAILABLE,
  PUBLIC_HOMEPAGE_FEATURED_LIMIT,
  selectTemporaryHomepageFeatured,
} from "./homepage-second-viewport";

describe("homepage second-viewport capability markers", () => {
  it("documents that video and gallery public data sources do not exist yet", () => {
    assert.equal(
      HOMEPAGE_VIDEO_DATA_SOURCE_NOT_YET_AVAILABLE,
      "HOMEPAGE_VIDEO_DATA_SOURCE_NOT_YET_AVAILABLE",
    );
    assert.equal(
      HOMEPAGE_GALLERY_DATA_SOURCE_NOT_YET_AVAILABLE,
      "HOMEPAGE_GALLERY_DATA_SOURCE_NOT_YET_AVAILABLE",
    );
  });
});

describe("selectTemporaryHomepageFeatured", () => {
  it("excludes lead/support IDs and preserves incoming order", () => {
    const featured = selectTemporaryHomepageFeatured(
      [{ id: "lead" }, { id: "s1" }, { id: "s2" }, { id: "f1" }, { id: "f2" }],
      new Set(["lead", "s1", "s2"]),
    );
    assert.deepEqual(
      featured.map((item) => item.id),
      ["f1", "f2"],
    );
  });

  it("caps at 5 and is deterministic", () => {
    const candidates = Array.from({ length: 12 }, (_, index) => ({
      id: `story-${index}`,
    }));
    const featured = selectTemporaryHomepageFeatured(
      candidates,
      new Set(["story-0", "story-1", "story-2"]),
    );
    assert.equal(PUBLIC_HOMEPAGE_FEATURED_LIMIT, 5);
    assert.deepEqual(
      featured.map((item) => item.id),
      ["story-3", "story-4", "story-5", "story-6", "story-7"],
    );
  });

  it("returns an empty list when every candidate is excluded", () => {
    assert.deepEqual(
      selectTemporaryHomepageFeatured(
        [{ id: "lead" }, { id: "s1" }],
        new Set(["lead", "s1"]),
      ),
      [],
    );
  });
});
