import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ANALYTICS_IMPRESSION_POLICY } from "@magazine/domain/analytics-client";

const root = fileURLToPath(new URL("../..", import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("homepage instrumentation contract", () => {
  it("keeps the homepage server-first and emits HOMEPAGE_VIEW from an island", () => {
    const page = read("app/page.tsx");
    assert.equal(page.trimStart().startsWith("\"use client\""), false);
    assert.equal(page.includes("AnalyticsHomepageView"), true);
    assert.equal(page.includes("HomepageAnalyticsProvider"), true);
    assert.equal(page.includes("getPublicHomepage"), true);
    assert.equal(page.includes("homepage.homepageVersionId"), true);
  });

  it("uses canonical placements rather than CSS class names", () => {
    const placement = read("components/analytics/analytics-homepage-placement.tsx");
    const leadGrid = read("components/homepage-lead-grid.tsx");
    assert.equal(placement.includes("IntersectionObserver"), false);
    // Lead/support cards resolve their analytics placement dynamically from the
    // server-computed analyticsPlacements (LEAD vs RECENCY_FALLBACK), rather than
    // hardcoding ANALYTICS_PLACEMENT.LEAD, so a recency-backfilled slot is still tracked.
    assert.equal(leadGrid.includes("ANALYTICS_PLACEMENT.LEAD"), false);
    assert.equal(leadGrid.includes("ANALYTICS_PLACEMENT.CONVERSATION"), true);
    assert.equal(leadGrid.includes("found.placement"), true);
    assert.equal(leadGrid.includes("analyticsPlacements"), true);
    assert.equal(read("lib/analytics/impression.ts").includes(String(ANALYTICS_IMPRESSION_POLICY.MIN_VISIBLE_RATIO)), false);
    assert.equal(
      read("lib/analytics/impression.ts").includes("ANALYTICS_IMPRESSION_POLICY.MIN_VISIBLE_RATIO"),
      true,
    );
    assert.equal(
      read("lib/analytics/impression.ts").includes("ANALYTICS_IMPRESSION_POLICY.MIN_DWELL_MS"),
      true,
    );
  });
});
