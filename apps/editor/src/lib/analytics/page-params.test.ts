import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANALYTICS_CONTENT_SORT, ANALYTICS_REPORTING_METRIC } from "@magazine/domain";
import {
  ANALYTICS_RANGE_PRESET,
  analyticsPageHref,
  parseAnalyticsPageSearchParams,
} from "./page-params";

const NOW = new Date("2026-08-21T18:00:00.000Z");

describe("analytics page search params", () => {
  it("defaults to the last 7 reporting days ending today", () => {
    const { filters, rangeInvalid } = parseAnalyticsPageSearchParams({}, NOW);
    assert.equal(rangeInvalid, false);
    assert.equal(filters.preset, ANALYTICS_RANGE_PRESET.LAST_7_DAYS);
    assert.equal(filters.to, "2026-08-21");
    assert.equal(filters.from, "2026-08-15");
  });

  it("resolves the 30-day preset relative to the Istanbul reporting day", () => {
    const { filters } = parseAnalyticsPageSearchParams({ preset: "30d" }, NOW);
    assert.equal(filters.preset, ANALYTICS_RANGE_PRESET.LAST_30_DAYS);
    assert.equal(filters.to, "2026-08-21");
    assert.equal(filters.from, "2026-07-23");
  });

  it("accepts a bounded custom date-only range and marks it non-preset", () => {
    const { filters, rangeInvalid } = parseAnalyticsPageSearchParams(
      { from: "2026-08-01", to: "2026-08-10" },
      NOW,
    );
    assert.equal(rangeInvalid, false);
    assert.equal(filters.preset, null);
    assert.equal(filters.from, "2026-08-01");
    assert.equal(filters.to, "2026-08-10");
  });

  it("fails safely to the default 7-day window on an invalid range instead of throwing", () => {
    const { filters, rangeInvalid, period } = parseAnalyticsPageSearchParams(
      { from: "2030-01-01", to: "2020-01-01" },
      NOW,
    );
    assert.equal(rangeInvalid, true);
    assert.equal(filters.preset, ANALYTICS_RANGE_PRESET.LAST_7_DAYS);
    assert.ok(period.fromInclusive instanceof Date);
    assert.ok(period.toExclusive instanceof Date);
  });

  it("defaults an unrecognized metric to ARTICLE_VIEWS instead of surfacing a raw error", () => {
    const { filters } = parseAnalyticsPageSearchParams({ metric: "NOT_A_METRIC" }, NOW);
    assert.equal(filters.metric, ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS);
  });

  it("does not allow SESSIONS/VIDEO_PLAYS/UNIQUE_VISITORS to be selected as the chart metric", () => {
    const { filters } = parseAnalyticsPageSearchParams({ metric: "SESSIONS" }, NOW);
    assert.equal(filters.metric, ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS);
  });

  it("defaults an unrecognized sort to ARTICLE_VIEWS", () => {
    const { filters } = parseAnalyticsPageSearchParams({ sort: "NOT_A_SORT" }, NOW);
    assert.equal(filters.sort, ANALYTICS_CONTENT_SORT.ARTICLE_VIEWS);
  });

  it("defaults comparison on and turns it off only with compare=off", () => {
    assert.equal(parseAnalyticsPageSearchParams({}, NOW).filters.compare, true);
    assert.equal(
      parseAnalyticsPageSearchParams({ compare: "off" }, NOW).filters.compare,
      false,
    );
  });

  it("builds shareable hrefs that round-trip through the parser", () => {
    const href = analyticsPageHref({
      preset: ANALYTICS_RANGE_PRESET.LAST_30_DAYS,
      metric: ANALYTICS_REPORTING_METRIC.HOMEPAGE_CLICKS,
      sort: ANALYTICS_CONTENT_SORT.HOMEPAGE_CTR,
      compare: false,
    });
    const url = new URL(`http://editor.test${href}`);
    const reparsed = parseAnalyticsPageSearchParams(
      Object.fromEntries(url.searchParams.entries()),
      NOW,
    );
    assert.equal(reparsed.filters.preset, ANALYTICS_RANGE_PRESET.LAST_30_DAYS);
    assert.equal(reparsed.filters.metric, ANALYTICS_REPORTING_METRIC.HOMEPAGE_CLICKS);
    assert.equal(reparsed.filters.sort, ANALYTICS_CONTENT_SORT.HOMEPAGE_CTR);
    assert.equal(reparsed.filters.compare, false);
  });
});
