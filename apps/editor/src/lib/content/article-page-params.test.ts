import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArticleSearchParams } from "./article-page-params";

describe("parseArticleSearchParams", () => {
  it("defaults to list return path without version context", () => {
    const result = parseArticleSearchParams({});
    assert.equal(result.versionId, undefined);
    assert.equal(result.versionIdInvalid, false);
    assert.equal(result.fromReview, false);
    assert.equal(result.returnHref, "/");
  });

  it("keeps a valid versionId from the review queue", () => {
    const versionId = "01234567-89ab-cdef-0123-456789abcdef";
    const result = parseArticleSearchParams({
      versionId,
      from: "review",
      returnTo: "/review?q=spor",
    });
    assert.equal(result.versionId, versionId);
    assert.equal(result.fromReview, true);
    assert.equal(result.returnHref, "/review?q=spor");
  });

  it("flags invalid versionId instead of silently ignoring it", () => {
    const result = parseArticleSearchParams({ versionId: "not-a-uuid" });
    assert.equal(result.versionId, undefined);
    assert.equal(result.versionIdInvalid, true);
  });

  it("rejects protocol-relative returnTo", () => {
    const result = parseArticleSearchParams({ returnTo: "//evil.example" });
    assert.equal(result.returnHref, "/");
  });

  it("rejects external returnTo and keeps review filters on a safe internal path", () => {
    assert.equal(
      parseArticleSearchParams({ returnTo: "https://evil.example/review" }).returnHref,
      "/",
    );
    const safe = parseArticleSearchParams({
      from: "review",
      returnTo: "/review?q=spor&categoryId=11111111-1111-4111-8111-111111111111",
    });
    assert.equal(safe.fromReview, true);
    assert.equal(
      safe.returnHref,
      "/review?q=spor&categoryId=11111111-1111-4111-8111-111111111111",
    );
  });
});
