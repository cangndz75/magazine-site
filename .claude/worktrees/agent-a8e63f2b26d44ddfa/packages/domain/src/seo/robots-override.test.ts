import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseSeoRobotsOverride,
  SEO_ROBOTS_DIRECTIVE,
} from "./robots-override";

describe("stored robots override parser", () => {
  it("treats blank values as inherit/default", () => {
    assert.equal(parseSeoRobotsOverride(null).directive, SEO_ROBOTS_DIRECTIVE.DEFAULT);
    assert.equal(parseSeoRobotsOverride("   ").directive, SEO_ROBOTS_DIRECTIVE.DEFAULT);
  });

  it("normalizes noindex and none into a restrictive directive", () => {
    assert.equal(
      parseSeoRobotsOverride("noindex, follow").directive,
      SEO_ROBOTS_DIRECTIVE.NOINDEX,
    );
    assert.equal(parseSeoRobotsOverride("NONE").directive, SEO_ROBOTS_DIRECTIVE.NOINDEX);
  });

  it("cannot force index through unrecognized or index tokens", () => {
    const index = parseSeoRobotsOverride("index,follow");
    assert.equal(index.directive, SEO_ROBOTS_DIRECTIVE.DEFAULT);
    const junk = parseSeoRobotsOverride("javascript:alert(1)");
    assert.equal(junk.directive, SEO_ROBOTS_DIRECTIVE.DEFAULT);
    assert.equal(junk.unrecognized, true);
  });
});
