import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeSearchCursor, encodeSearchCursor } from "./cursor";
import { normalizeSearchQuery, parseSearchFilter } from "./normalize";
import { assertSafeSearchResultsDto } from "./safety";
import { SEARCH_FILTER } from "./types";

describe("search domain contract", () => {
  it("normalizes and bounds public search queries", () => {
    assert.deepEqual(normalizeSearchQuery(""), { ok: false, code: "EMPTY" });
    assert.deepEqual(normalizeSearchQuery("a"), { ok: false, code: "TOO_SHORT" });
    assert.deepEqual(normalizeSearchQuery("%a_"), { ok: false, code: "TOO_SHORT" });
    assert.deepEqual(normalizeSearchQuery("  Deniz  "), {
      ok: true,
      normalizedQuery: "Deniz",
    });
    assert.deepEqual(
      normalizeSearchQuery("x".repeat(121)),
      { ok: false, code: "TOO_LONG" },
    );
  });

  it("strips ILIKE wildcards from normalized queries", () => {
    assert.deepEqual(normalizeSearchQuery("den%iz_"), {
      ok: true,
      normalizedQuery: "deniz",
    });
  });

  it("parses supported search filters safely", () => {
    assert.equal(parseSearchFilter("ARTICLE"), SEARCH_FILTER.ARTICLE);
    assert.equal(parseSearchFilter("unknown"), SEARCH_FILTER.ALL);
  });

  it("round-trips search cursors", () => {
    const cursor = {
      publishedAt: "2026-08-22T10:00:00.000Z",
      id: "11111111-1111-4111-8111-111111111111",
      kind: "ARTICLE" as const,
    };
    const encoded = encodeSearchCursor(cursor);
    assert.deepEqual(decodeSearchCursor(encoded), cursor);
    assert.equal(decodeSearchCursor("invalid"), null);
  });

  it("rejects sensitive keys in search DTO boundary", () => {
    assert.doesNotThrow(() =>
      assertSafeSearchResultsDto({
        query: "deniz",
        normalizedQuery: "deniz",
        filter: "ALL",
        items: [{ kind: "ARTICLE", id: "1", title: "t", href: "/x" }],
        nextCursor: null,
      }),
    );
    assert.throws(
      () =>
        assertSafeSearchResultsDto({
          items: [{ storageKey: "secret" }],
        }),
      /forbidden key/i,
    );
  });
});
