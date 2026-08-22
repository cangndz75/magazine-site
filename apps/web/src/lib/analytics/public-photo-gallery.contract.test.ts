import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("public photo gallery page contract", () => {
  it("uses the dedicated photo gallery presentation without article carousel chrome", () => {
    const page = read("app/galeri/[slug]/page.tsx");
    const story = read("components/public-photo-gallery-story.tsx");

    assert.equal(page.includes("public-photo-gallery-page"), true);
    assert.equal(page.includes("PublicPhotoGalleryHeader"), true);
    assert.equal(page.includes("PublicPhotoGalleryStory"), true);
    assert.equal(page.includes("PublicPhotoGalleryRelated"), true);
    assert.equal(page.includes("getPublicHomepage"), true);
    assert.equal(page.includes("PublicArticleGallery"), false);
    assert.equal(page.includes("ArticleHeader"), false);
    assert.equal(page.includes("AnalyticsArticleView"), true);

    assert.equal(story.includes("galleryAnalyticsEmissions"), true);
    assert.equal(story.includes("photo-gallery-lightbox"), true);
    assert.equal(story.includes("storageKey"), false);
  });
});
