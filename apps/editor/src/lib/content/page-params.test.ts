import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePageSearchParams } from "./page-params";

describe("parsePageSearchParams", () => {
  it("returns defaults for empty params", () => {
    const result = parsePageSearchParams({});
    assert.equal(result.limit, 20);
    assert.equal(result.cursor, null);
    assert.equal(result.search, null);
    assert.equal(result.publicationStatus, undefined);
    assert.equal(result.workflowStatus, undefined);
    assert.equal(result.categoryId, undefined);
    assert.equal(result.authorId, undefined);
    assert.equal(result.scheduledOnly, false);
    assert.equal(result.view, "all");
    assert.equal(result.sort, "updated_desc");
  });

  it("parses valid search", () => {
    const result = parsePageSearchParams({ q: "  makale  " });
    assert.equal(result.search, "makale");
  });

  it("sanitizes empty search to null", () => {
    const result = parsePageSearchParams({ q: "   " });
    assert.equal(result.search, null);
  });

  it("parses valid publicationStatus", () => {
    const result = parsePageSearchParams({ publicationStatus: "PUBLISHED" });
    assert.equal(result.publicationStatus, "PUBLISHED");
  });

  it("ignores invalid publicationStatus", () => {
    const result = parsePageSearchParams({ publicationStatus: "INVALID" });
    assert.equal(result.publicationStatus, undefined);
  });

  it("parses valid workflowStatus", () => {
    const result = parsePageSearchParams({ workflowStatus: "IN_REVIEW" });
    assert.equal(result.workflowStatus, "IN_REVIEW");
  });

  it("ignores invalid workflowStatus", () => {
    const result = parsePageSearchParams({ workflowStatus: "BOGUS" });
    assert.equal(result.workflowStatus, undefined);
  });

  it("parses valid categoryId UUID", () => {
    const id = "01234567-89ab-cdef-0123-456789abcdef";
    const result = parsePageSearchParams({ categoryId: id });
    assert.equal(result.categoryId, id);
  });

  it("ignores non-UUID categoryId", () => {
    const result = parsePageSearchParams({ categoryId: "not-a-uuid" });
    assert.equal(result.categoryId, undefined);
  });

  it("parses valid authorId UUID", () => {
    const id = "01234567-89ab-cdef-0123-456789abcdef";
    const result = parsePageSearchParams({ authorId: id });
    assert.equal(result.authorId, id);
  });

  it("ignores non-UUID authorId", () => {
    const result = parsePageSearchParams({ authorId: "raw-author-id" });
    assert.equal(result.authorId, undefined);
  });

  it("parses scheduledOnly=1", () => {
    const result = parsePageSearchParams({ scheduledOnly: "1" });
    assert.equal(result.scheduledOnly, true);
  });

  it("parses scheduledOnly=true", () => {
    const result = parsePageSearchParams({ scheduledOnly: "true" });
    assert.equal(result.scheduledOnly, true);
  });

  it("ignores scheduledOnly=0", () => {
    const result = parsePageSearchParams({ scheduledOnly: "0" });
    assert.equal(result.scheduledOnly, false);
  });

  it("clamps limit", () => {
    const result = parsePageSearchParams({ limit: "1000" });
    assert.equal(result.limit, 50);
  });

  it("defaults for NaN limit", () => {
    const result = parsePageSearchParams({ limit: "abc" });
    assert.equal(result.limit, 20);
  });

  it("handles array param values gracefully", () => {
    const result = parsePageSearchParams({
      q: ["first", "second"] as unknown as string,
    });
    assert.equal(result.search, null);
  });

  it("parses valid newsroom view", () => {
    const result = parsePageSearchParams({ view: "in_review" });
    assert.equal(result.view, "in_review");
  });

  it("ignores invalid newsroom view", () => {
    const result = parsePageSearchParams({ view: "bogus" });
    assert.equal(result.view, "all");
  });

  it("parses valid newsroom sort", () => {
    const result = parsePageSearchParams({ sort: "schedule_asc" });
    assert.equal(result.sort, "schedule_asc");
  });

  it("ignores invalid newsroom sort", () => {
    const result = parsePageSearchParams({ sort: "bogus" });
    assert.equal(result.sort, "updated_desc");
  });
});
