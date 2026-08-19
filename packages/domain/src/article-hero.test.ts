import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MEDIA_TYPE } from "./media-type";
import { PUBLISHING_ERROR } from "./publishing/errors";
import {
  ARTICLE_HERO_ALT_TEXT_MAX,
  assertHeroAssignableMediaType,
  canonicalizeHeroAltText,
  canonicalizeHeroCredit,
} from "./article-hero";

describe("article hero domain", () => {
  it("accepts IMAGE media for HERO assignment", () => {
    assert.deepEqual(assertHeroAssignableMediaType(MEDIA_TYPE.IMAGE), {
      ok: true,
      value: true,
    });
  });

  it("rejects non-image media types for HERO", () => {
    assert.deepEqual(assertHeroAssignableMediaType(MEDIA_TYPE.VIDEO), {
      ok: false,
      code: PUBLISHING_ERROR.INVALID_HERO_MEDIA,
    });
    assert.deepEqual(assertHeroAssignableMediaType(MEDIA_TYPE.AUDIO), {
      ok: false,
      code: PUBLISHING_ERROR.INVALID_HERO_MEDIA,
    });
  });

  it("canonicalizes hero alt text within bounds", () => {
    assert.deepEqual(canonicalizeHeroAltText("  crowd scene  "), {
      ok: true,
      value: "crowd scene",
    });
    assert.deepEqual(canonicalizeHeroAltText(""), {
      ok: true,
      value: null,
    });
    assert.deepEqual(
      canonicalizeHeroAltText("x".repeat(ARTICLE_HERO_ALT_TEXT_MAX + 1)),
      { ok: false, code: PUBLISHING_ERROR.INVALID_RELATION },
    );
  });

  it("canonicalizes hero credit within bounds", () => {
    assert.deepEqual(canonicalizeHeroCredit(" Ada Photo "), {
      ok: true,
      value: "Ada Photo",
    });
    assert.deepEqual(canonicalizeHeroCredit("x".repeat(201)), {
      ok: false,
      code: PUBLISHING_ERROR.INVALID_RELATION,
    });
  });
});
