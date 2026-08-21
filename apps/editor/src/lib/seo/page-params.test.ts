import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SEO_FINDING_FILTER,
  SEO_LEGAL_WITHDRAWAL_FILTER,
} from "@magazine/domain";
import {
  parseSeoPageSearchParams,
  seoListQueryString,
  seoPageHasFilters,
} from "./page-params";

describe("SEO command center page params", () => {
  it("serializes search, severity, missing-meta, and cursor filters", () => {
    const filters = parseSeoPageSearchParams({
      q: "ekonomi",
      findingFilter: "ERRORS",
      missingMetaDescription: "1",
      missingHero: "1",
      missingHeroAlt: "1",
      missingSeoTitle: "1",
      indexable: "0",
      notPublished: "1",
      legalWithdrawal: "ANY",
      categoryId: "1a3ccd0d-594e-41cc-9350-9a6085699090",
    });

    assert.equal(filters.search, "ekonomi");
    assert.equal(filters.findingFilter, SEO_FINDING_FILTER.ERRORS);
    assert.equal(filters.missingMetaDescription, true);
    assert.equal(filters.missingHero, true);
    assert.equal(filters.missingHeroAlt, true);
    assert.equal(filters.missingSeoTitle, true);
    assert.equal(filters.indexable, false);
    assert.equal(filters.notPublished, true);
    assert.equal(filters.legalWithdrawal, SEO_LEGAL_WITHDRAWAL_FILTER.ANY);
    assert.equal(seoPageHasFilters(filters), true);

    const qs = seoListQueryString(filters);
    assert.equal(qs.includes("q=ekonomi"), true);
    assert.equal(qs.includes("findingFilter=ERRORS"), true);
    assert.equal(qs.includes("missingMetaDescription=1"), true);
    assert.equal(qs.includes("indexable=0"), true);
    assert.equal(qs.includes("notPublished=1"), true);
  });

  it("ignores invalid tokens instead of inventing a filter", () => {
    const filters = parseSeoPageSearchParams({
      findingFilter: "BROKEN",
      indexable: "maybe",
      publicationStatus: "LIVE",
    });
    assert.equal(filters.findingFilter, undefined);
    assert.equal(filters.indexable, undefined);
    assert.equal(filters.publicationStatus, undefined);
    assert.equal(seoPageHasFilters(filters), false);
  });
});
