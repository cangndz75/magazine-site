import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOMEPAGE_GALLERY_DATA_SOURCE_NOT_YET_AVAILABLE,
  PUBLIC_HOMEPAGE_FEATURED_LIMIT,
  PUBLIC_HOMEPAGE_LATEST_LIMIT,
  selectTemporaryHomepageFeatured,
  selectTemporaryHomepageLatest,
} from "./homepage-second-viewport";

describe("homepage second-viewport capability markers", () => {
  it("documents that gallery public data source does not exist yet", () => {
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

describe("selectTemporaryHomepageLatest", () => {
  it("excludes displayed IDs and preserves incoming recency order", () => {
    const latest = selectTemporaryHomepageLatest(
      [{ id: "lead" }, { id: "s1" }, { id: "s2" }, { id: "f1" }, { id: "l1" }, { id: "l2" }],
      new Set(["lead", "s1", "s2", "f1"]),
    );
    assert.deepEqual(
      latest.map((item) => item.id),
      ["l1", "l2"],
    );
  });

  it("caps at PUBLIC_HOMEPAGE_LATEST_LIMIT and is deterministic", () => {
    const candidates = Array.from({ length: 20 }, (_, index) => ({
      id: `story-${index}`,
    }));
    const latest = selectTemporaryHomepageLatest(
      candidates,
      new Set(["story-0", "story-1", "story-2"]),
    );
    assert.equal(PUBLIC_HOMEPAGE_LATEST_LIMIT, 6);
    assert.deepEqual(
      latest.map((item) => item.id),
      ["story-3", "story-4", "story-5", "story-6", "story-7", "story-8"],
    );
  });

  it("never re-displays a story already shown in lead/support/featured", () => {
    const candidates = [
      { id: "lead" },
      { id: "s1" },
      { id: "s2" },
      { id: "f1" },
      { id: "f2" },
      { id: "f3" },
      { id: "f4" },
      { id: "f5" },
      { id: "l1" },
    ];
    const displayed = new Set(["lead", "s1", "s2", "f1", "f2", "f3", "f4", "f5"]);
    const latest = selectTemporaryHomepageLatest(candidates, displayed);
    for (const item of latest) {
      assert.equal(displayed.has(item.id), false);
    }
  });

  it("returns an empty list when every candidate is excluded", () => {
    assert.deepEqual(
      selectTemporaryHomepageLatest(
        [{ id: "lead" }, { id: "s1" }],
        new Set(["lead", "s1"]),
      ),
      [],
    );
  });
});
