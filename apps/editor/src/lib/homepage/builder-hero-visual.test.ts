import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { homepageBuilderHeroVisual } from "./builder-hero-visual";

describe("homepage builder hero visual fallback", () => {
  it("shows a thumbnail when a safe URL is present", () => {
    assert.equal(
      homepageBuilderHeroVisual(
        {
          url: "https://media.example.test/qa/hero-event.jpg",
          width: 1600,
          height: 900,
          altText: null,
          credit: null,
        },
        false,
      ),
      "image",
    );
  });

  it("falls back to placeholder when there is no HERO", () => {
    assert.equal(homepageBuilderHeroVisual(null, false), "placeholder");
  });

  it("falls back to placeholder after a missing-object load failure", () => {
    assert.equal(
      homepageBuilderHeroVisual(
        {
          url: "https://media.example.test/uploads/missing.jpg",
          width: 240,
          height: 160,
          altText: null,
          credit: null,
        },
        true,
      ),
      "placeholder",
    );
  });
});
