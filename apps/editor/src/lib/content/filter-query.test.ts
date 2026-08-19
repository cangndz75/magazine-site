import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCursorUpdate,
  applyFilterUpdates,
  hrefWithQuery,
  mergeSelectedOption,
} from "./filter-query";

describe("filter query persistence", () => {
  it("category selection updates filter state and clears pagination", () => {
    const current = new URLSearchParams(
      "q=spor&cursor=abc&publicationStatus=PUBLISHED",
    );
    const next = applyFilterUpdates(current, {
      categoryId: "01234567-89ab-cdef-0123-456789abcdef",
    });
    assert.equal(next.get("categoryId"), "01234567-89ab-cdef-0123-456789abcdef");
    assert.equal(next.get("q"), "spor");
    assert.equal(next.get("publicationStatus"), "PUBLISHED");
    assert.equal(next.get("cursor"), null);
  });

  it("author selection updates filter state and clears pagination", () => {
    const current = new URLSearchParams("cursor=abc&workflowStatus=DRAFT");
    const next = applyFilterUpdates(current, {
      authorId: "abcdef01-2345-6789-abcd-ef0123456789",
    });
    assert.equal(next.get("authorId"), "abcdef01-2345-6789-abcd-ef0123456789");
    assert.equal(next.get("workflowStatus"), "DRAFT");
    assert.equal(next.get("cursor"), null);
  });

  it("clear/reset removes a single filter without dropping the others", () => {
    const current = new URLSearchParams(
      "q=spor&categoryId=01234567-89ab-cdef-0123-456789abcdef&authorId=abcdef01-2345-6789-abcd-ef0123456789",
    );
    const next = applyFilterUpdates(current, { categoryId: null });
    assert.equal(next.get("categoryId"), null);
    assert.equal(next.get("q"), "spor");
    assert.equal(next.get("authorId"), "abcdef01-2345-6789-abcd-ef0123456789");
  });

  it("keeps filters when moving to the next cursor page", () => {
    const current = new URLSearchParams(
      "q=spor&categoryId=01234567-89ab-cdef-0123-456789abcdef",
    );
    const next = applyCursorUpdate(current, "cursor-token");
    assert.equal(next.get("cursor"), "cursor-token");
    assert.equal(next.get("q"), "spor");
    assert.equal(next.get("categoryId"), "01234567-89ab-cdef-0123-456789abcdef");
  });

  it("first-page href clears only the cursor", () => {
    const current = new URLSearchParams("q=spor&cursor=abc");
    const href = hrefWithQuery("/", applyFilterUpdates(current, {}));
    assert.equal(href, "/?q=spor");
  });

  it("merges a selected option that is outside the bounded first page", () => {
    const selected = { id: "selected", name: "Seçili" };
    const merged = mergeSelectedOption(selected, [{ id: "other", name: "Diğer" }]);
    assert.equal(merged[0]?.id, "selected");
    assert.equal(merged.length, 2);
  });
});
