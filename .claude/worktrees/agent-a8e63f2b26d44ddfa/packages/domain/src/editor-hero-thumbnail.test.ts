import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MEDIA_TYPE } from "./media-type";
import { PUBLICATION_STATUS } from "./publication-status";
import {
  selectEditorHomepageHeroVersionId,
  toEditorSafeHeroThumbnail,
} from "./editor-hero-thumbnail";

describe("selectEditorHomepageHeroVersionId", () => {
  it("uses publishedVersionId for currently published items", () => {
    assert.equal(
      selectEditorHomepageHeroVersionId({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: "published-a",
        displayVersionId: "draft-b",
      }),
      "published-a",
    );
  });

  it("uses display version when the item is not currently public", () => {
    assert.equal(
      selectEditorHomepageHeroVersionId({
        publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
        publishedVersionId: null,
        displayVersionId: "draft-b",
      }),
      "draft-b",
    );
    assert.equal(
      selectEditorHomepageHeroVersionId({
        publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
        publishedVersionId: "preserved-published",
        displayVersionId: "draft-b",
      }),
      "draft-b",
    );
  });

  it("returns null when no version is available", () => {
    assert.equal(
      selectEditorHomepageHeroVersionId({
        publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
        publishedVersionId: null,
        displayVersionId: null,
      }),
      null,
    );
  });
});

describe("toEditorSafeHeroThumbnail", () => {
  it("projects only the editor-safe HERO fields", () => {
    assert.deepEqual(
      toEditorSafeHeroThumbnail({
        mediaType: MEDIA_TYPE.IMAGE,
        publicUrl: " https://media.example.test/qa/hero-event.jpg ",
        width: 1600,
        height: 900,
        altText: " Cover ",
        credit: " Photographer ",
      }),
      {
        url: "https://media.example.test/qa/hero-event.jpg",
        width: 1600,
        height: 900,
        altText: "Cover",
        credit: "Photographer",
      },
    );
  });

  it("returns null when there is no HERO", () => {
    assert.equal(
      toEditorSafeHeroThumbnail({
        mediaType: MEDIA_TYPE.IMAGE,
        publicUrl: null,
        width: 1600,
        height: 900,
        altText: "Cover",
        credit: null,
      }),
      null,
    );
  });

  it("does not use a VIDEO HERO as an image thumbnail", () => {
    assert.equal(
      toEditorSafeHeroThumbnail({
        mediaType: MEDIA_TYPE.VIDEO,
        publicUrl: "https://media.example.test/clip.mp4",
        width: 1920,
        height: 1080,
        altText: "Clip",
        credit: null,
      }),
      null,
    );
  });

  it("does not copy storageKey or rights notes even if callers hold them", () => {
    const projection = toEditorSafeHeroThumbnail({
      mediaType: MEDIA_TYPE.IMAGE,
      publicUrl: "https://media.example.test/uploads/hero.jpg",
      width: 800,
      height: 600,
      altText: "Hero",
      credit: "Desk",
    });
    const serialized = JSON.stringify(projection);
    assert.equal(serialized.includes("storageKey"), false);
    assert.equal(serialized.includes("licenseNote"), false);
    assert.deepEqual(Object.keys(projection ?? {}).sort(), [
      "altText",
      "credit",
      "height",
      "url",
      "width",
    ]);
  });
});
