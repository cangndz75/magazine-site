import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertContentAuditChangeSet,
  diffAuditScalarFields,
  type ContentAuditScalarInput,
} from "./content-audit";

function scalars(
  overrides: Partial<ContentAuditScalarInput> = {},
): ContentAuditScalarInput {
  return {
    title: "Title",
    subtitle: null,
    excerpt: null,
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    robots: null,
    credibility: null,
    credibilitySource: null,
    source: null,
    sourceOrganization: null,
    sourceUrl: null,
    syndicated: false,
    isMaterialUpdate: false,
    ...overrides,
  };
}

describe("content audit scalar changes", () => {
  it("omits unchanged fields", () => {
    assert.deepEqual(diffAuditScalarFields(scalars(), scalars()), []);
  });

  it("records deterministic scalar changes", () => {
    assert.deepEqual(
      diffAuditScalarFields(
        scalars({ title: "Old", excerpt: null }),
        scalars({ title: "New", excerpt: "Added" }),
      ),
      [
        { field: "title", before: "Old", after: "New" },
        { field: "excerpt", before: null, after: "Added" },
      ],
    );
  });

  it("records removed nullable values and boolean flips", () => {
    assert.deepEqual(
      diffAuditScalarFields(
        scalars({ sourceUrl: "https://example.test/source", syndicated: false }),
        scalars({ sourceUrl: null, syndicated: true }),
      ),
      [
        {
          field: "sourceUrl",
          before: "https://example.test/source",
          after: null,
        },
        { field: "syndicated", before: false, after: true },
      ],
    );
  });
});

describe("content audit change-set validation", () => {
  it("accepts bounded scalar, body, and relation summaries", () => {
    const changeSet = {
      scalarChanges: [{ field: "title", before: "Old", after: "New" }],
      bodyChange: { changed: true, detailLimited: true },
      relationChanges: [
        {
          relation: "categories",
          beforeCount: 1,
          afterCount: 2,
          changed: true,
          detailLimited: true,
        },
      ],
      detailLimited: true,
    };

    assert.deepEqual(assertContentAuditChangeSet(changeSet), changeSet);
  });

  it("accepts a compact legal action pointer", () => {
    const changeSet = {
      legalAction: {
        actionId: "11111111-1111-4111-8111-111111111111",
        actionType: "CORRECTION",
        polarity: "APPLY",
        reasonCategory: "FACTUAL_ERROR",
        hasPublicNote: true,
      },
    };
    assert.deepEqual(assertContentAuditChangeSet(changeSet), changeSet);
  });

  it("rejects invalid audit payloads", () => {
    assert.throws(() => assertContentAuditChangeSet("bad"));
    assert.throws(() =>
      assertContentAuditChangeSet({
        scalarChanges: [{ field: "password", before: null, after: "secret" }],
      }),
    );
    assert.throws(() =>
      assertContentAuditChangeSet({
        bodyChange: { changed: "yes", detailLimited: true },
      }),
    );
  });
});
