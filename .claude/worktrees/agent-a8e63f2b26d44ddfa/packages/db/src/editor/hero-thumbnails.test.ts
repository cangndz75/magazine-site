import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLICATION_STATUS } from "@magazine/domain";
import { heroThumbnailForEditorItem } from "./hero-thumbnails";

const thumbnail = {
  url: "https://media.example.test/qa/hero.jpg",
  width: 1600,
  height: 900,
  altText: "Hero",
  credit: null,
};

describe("heroThumbnailForEditorItem", () => {
  it("reads the published version thumbnail for a live article", () => {
    const byVersion = new Map([
      ["published-a", thumbnail],
      [
        "draft-b",
        {
          ...thumbnail,
          url: "https://media.example.test/qa/hero-b.jpg",
        },
      ],
    ]);

    assert.deepEqual(
      heroThumbnailForEditorItem(
        {
          publicationStatus: PUBLICATION_STATUS.PUBLISHED,
          publishedVersionId: "published-a",
          displayVersionId: "draft-b",
        },
        byVersion,
      ),
      thumbnail,
    );
  });

  it("returns null when the selected version has no IMAGE HERO", () => {
    assert.equal(
      heroThumbnailForEditorItem(
        {
          publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
          publishedVersionId: null,
          displayVersionId: "draft-b",
        },
        new Map(),
      ),
      null,
    );
  });
});
