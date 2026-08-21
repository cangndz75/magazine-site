import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  claimPageViewOnce,
  resetPageViewLifecycleForTests,
} from "./page-view-lifecycle";

afterEach(() => {
  resetPageViewLifecycleForTests();
});

describe("analytics page-view lifecycle", () => {
  it("emits one logical page view and ignores rerenders of the same lifecycle", () => {
    const key = "ARTICLE_VIEW:content-a:idx:1";
    assert.equal(claimPageViewOnce(key), true);
    assert.equal(claimPageViewOnce(key), false);
    assert.equal(claimPageViewOnce(key), false);
  });

  it("emits a new ARTICLE_VIEW after navigation to another article", () => {
    assert.equal(claimPageViewOnce("ARTICLE_VIEW:content-a:idx:1"), true);
    assert.equal(claimPageViewOnce("ARTICLE_VIEW:content-b:idx:2"), true);
  });

  it("emits a new ARTICLE_VIEW when returning via a new history generation", () => {
    assert.equal(claimPageViewOnce("ARTICLE_VIEW:content-a:idx:1"), true);
    assert.equal(claimPageViewOnce("ARTICLE_VIEW:content-b:idx:2"), true);
    assert.equal(claimPageViewOnce("ARTICLE_VIEW:content-a:idx:3"), true);
  });
});
