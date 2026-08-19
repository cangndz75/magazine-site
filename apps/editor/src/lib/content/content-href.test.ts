import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildArticleHref, buildListReturnTo } from "./content-href";

const CONTENT_ID = "01234567-89ab-cdef-0123-456789abcdef";
const VERSION_ID = "abcdef01-2345-6789-abcd-ef0123456789";

describe("article href builders", () => {
  it("routes a content row to the article workspace", () => {
    const href = buildArticleHref({
      contentItemId: CONTENT_ID,
      returnTo: "/?q=spor",
    });
    assert.equal(href, `/content/${CONTENT_ID}?returnTo=${encodeURIComponent("/?q=spor")}`);
  });

  it("preserves review-queue version context", () => {
    const href = buildArticleHref({
      contentItemId: CONTENT_ID,
      versionId: VERSION_ID,
      from: "review",
      returnTo: "/review?categoryId=x",
    });
    assert.equal(href.includes(`/content/${CONTENT_ID}?`), true);
    assert.equal(href.includes(`versionId=${VERSION_ID}`), true);
    assert.equal(href.includes("from=review"), true);
    assert.equal(href.includes("returnTo="), true);
  });

  it("omits default list returnTo", () => {
    const href = buildArticleHref({
      contentItemId: CONTENT_ID,
      returnTo: "/",
    });
    assert.equal(href, `/content/${CONTENT_ID}`);
  });

  it("drops a focused historical versionId when returning to the new draft", () => {
    const href = buildArticleHref({
      contentItemId: CONTENT_ID,
      from: "review",
      returnTo: "/review?q=spor",
    });
    assert.equal(href.includes("versionId="), false);
    assert.equal(href.includes("from=review"), true);
    assert.equal(href.includes("returnTo="), true);
  });

  it("builds list return paths without dropping filters", () => {
    assert.equal(buildListReturnTo("q=a&categoryId=b"), "/?q=a&categoryId=b");
    assert.equal(buildListReturnTo("q=a", "/review"), "/review?q=a");
    assert.equal(buildListReturnTo(""), "/");
  });
});
