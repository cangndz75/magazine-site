import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "../..");

const FORBIDDEN_TOKENS = [
  "analyticsContext",
  "eventId",
  "eventFingerprint",
  "anonymousSessionId",
  "anonymousVisitorId",
  "storageKey",
  "internalNote",
  "rightsNote",
  "passwordHash",
  "secretCiphertext",
  "mfaSecret",
];

const analyticsUiFiles = [
  "app/(workspace)/analytics/page.tsx",
  "components/analytics-workspace.tsx",
  "components/analytics/analytics-report-header.tsx",
  "components/analytics/analytics-kpi-strip.tsx",
  "components/analytics/analytics-primary-chart-section.tsx",
  "components/analytics/analytics-timeseries-chart.tsx",
  "components/analytics/analytics-top-content.tsx",
  "components/analytics/analytics-content-panel.tsx",
  "components/analytics/analytics-traffic-sources.tsx",
  "components/analytics/analytics-category-performance.tsx",
  "components/analytics/analytics-author-performance.tsx",
  "components/analytics/analytics-homepage-performance.tsx",
  "components/analytics/analytics-media-engagement.tsx",
  "components/analytics/analytics-data-health.tsx",
];

describe("analytics dashboard UI privacy boundary", () => {
  for (const relativePath of analyticsUiFiles) {
    it(`${relativePath} does not reference forbidden analytics/security fields`, () => {
      const source = readFileSync(path.join(root, relativePath), "utf8");
      for (const token of FORBIDDEN_TOKENS) {
        assert.equal(source.includes(token), false, `${relativePath} references ${token}`);
      }
    });
  }

  it("page is authorized on ANALYTICS_READ and never on a mutation capability", () => {
    const source = readFileSync(path.join(root, "app/(workspace)/analytics/page.tsx"), "utf8");
    assert.match(source, /requireCapability\(CAPABILITY\.ANALYTICS_READ\)/);
    assert.equal(source.includes("CAPABILITY.CONTENT_EDIT"), false);
    assert.equal(source.includes("CAPABILITY.HOMEPAGE_MANAGE"), false);
  });

  it("page asserts every fetched report DTO is safe before rendering", () => {
    const source = readFileSync(path.join(root, "app/(workspace)/analytics/page.tsx"), "utf8");
    assert.match(source, /assertSafeAnalyticsDto/);
  });

  it("page never reads analytics_events directly and only uses report functions", () => {
    const source = readFileSync(path.join(root, "app/(workspace)/analytics/page.tsx"), "utf8");
    assert.equal(source.includes("analyticsEvents"), false);
    assert.match(source, /getAnalyticsOverview/);
    assert.match(source, /getAnalyticsTimeSeries/);
    assert.match(source, /getAnalyticsContentPerformance/);
    assert.match(source, /getAnalyticsSources/);
    assert.match(source, /getAnalyticsCategories/);
    assert.match(source, /getAnalyticsAuthors/);
    assert.match(source, /getAnalyticsHomepageSlots/);
  });

  it("content panel does not expose body, legal notes, or rights internals", () => {
    const source = readFileSync(
      path.join(root, "components/analytics/analytics-content-panel.tsx"),
      "utf8",
    );
    assert.equal(source.includes(".body"), false);
    assert.equal(source.includes("legalNote"), false);
    assert.equal(source.includes("rights"), false);
  });

  it("layout exposes Analytics navigation only behind ANALYTICS_READ", () => {
    const source = readFileSync(path.join(root, "app/(workspace)/layout.tsx"), "utf8");
    const navigation = readFileSync(
      path.join(root, "lib/workspace/navigation.ts"),
      "utf8",
    );
    assert.match(source, /canReadAnalytics/);
    assert.match(source, /CAPABILITY\.ANALYTICS_READ/);
    assert.match(navigation, /href: "\/analytics"/);
    assert.match(navigation, /Analytics/);
  });
});
