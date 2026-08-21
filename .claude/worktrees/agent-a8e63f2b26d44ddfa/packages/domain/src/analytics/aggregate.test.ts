import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYTICS_AUTHOR_ATTRIBUTION,
  ANALYTICS_BUCKET_TIMEZONE_POLICY,
  ANALYTICS_CONTENT_IDENTITY_POLICY,
  ANALYTICS_CTR_POLICY,
  ANALYTICS_ENTITY_REPORTING,
  ANALYTICS_EVENT_NAME,
  ANALYTICS_FRESHNESS_POLICY,
  ANALYTICS_PLACEMENT,
  ANALYTICS_REPORTING_ERROR,
  ANALYTICS_REPORTING_METRIC,
  ANALYTICS_SESSION_REPORTING,
  ANALYTICS_SURFACE,
  ANALYTICS_TAXONOMY_VERSION,
  ANALYTICS_TIME_BUCKET,
  ANALYTICS_TRAFFIC_KIND,
  ANALYTICS_TRAFFIC_SOURCE,
  ANALYTICS_VIDEO_PLAY_REPORTING,
  alignAnalyticsAggregationWindow,
  analyticsFactIsMetricEligible,
  compareAnalyticsCounts,
  computeAnalyticsAggregates,
  homepageCtr,
  isDefaultAudienceTrafficKind,
  parseAnalyticsReportingMetric,
  parseAnalyticsReportingPeriod,
  reportingHomepageCtr,
  reportingDayBucketStart,
  utcHourBucketStart,
  type AnalyticsAggregateFact,
} from "./index";

const CONTENT_A = "11111111-1111-4111-8111-111111111111";
const CONTENT_B = "22222222-2222-4222-8222-222222222222";
const VERSION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VERSION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AUTHOR_1 = "33333333-3333-4333-8333-333333333331";
const AUTHOR_2 = "33333333-3333-4333-8333-333333333332";
const CATEGORY_A = "44444444-4444-4444-8444-444444444441";
const MEDIA_1 = "55555555-5555-4555-8555-555555555551";
const VIDEO_1 = "66666666-6666-4666-8666-666666666661";
const SESSION_1 = "77777777-7777-4777-8777-777777777771";
const HOMEPAGE_V1 = "88888888-8888-4888-8888-888888888881";

function fact(
  overrides: Partial<AnalyticsAggregateFact> & Pick<AnalyticsAggregateFact, "eventId" | "eventName">,
): AnalyticsAggregateFact {
  return {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    occurredAt: new Date("2026-08-21T10:15:00.000Z"),
    anonymousSessionId: SESSION_1,
    trafficKind: ANALYTICS_TRAFFIC_KIND.HUMAN,
    trafficSource: ANALYTICS_TRAFFIC_SOURCE.SEARCH,
    referrerHost: "google.com",
    contentItemId: CONTENT_A,
    publishedVersionId: VERSION_A,
    surface: ANALYTICS_SURFACE.ARTICLE,
    placement: null,
    homepageVersionId: null,
    position: null,
    mediaId: null,
    videoAssetId: null,
    primaryCategoryId: CATEGORY_A,
    authorIds: [AUTHOR_1],
    ...overrides,
  };
}

describe("analytics aggregation eligibility", () => {
  it("uses the exact Pass 1 HUMAN-only default audience policy", () => {
    assert.equal(analyticsFactIsMetricEligible(ANALYTICS_TRAFFIC_KIND.HUMAN), true);
    assert.equal(analyticsFactIsMetricEligible(ANALYTICS_TRAFFIC_KIND.BOT), false);
    assert.equal(analyticsFactIsMetricEligible(ANALYTICS_TRAFFIC_KIND.INTERNAL), false);
    assert.equal(analyticsFactIsMetricEligible(ANALYTICS_TRAFFIC_KIND.TEST), false);
    assert.equal(analyticsFactIsMetricEligible(ANALYTICS_TRAFFIC_KIND.UNKNOWN), false);
    assert.equal(
      analyticsFactIsMetricEligible(ANALYTICS_TRAFFIC_KIND.HUMAN),
      isDefaultAudienceTrafficKind(ANALYTICS_TRAFFIC_KIND.HUMAN),
    );
    assert.equal(
      analyticsFactIsMetricEligible(ANALYTICS_TRAFFIC_KIND.UNKNOWN),
      isDefaultAudienceTrafficKind(ANALYTICS_TRAFFIC_KIND.UNKNOWN),
    );
  });

  it("stores reporting-calendar daily buckets and UTC hourly buckets", () => {
    assert.equal(ANALYTICS_BUCKET_TIMEZONE_POLICY.STORAGE_INSTANT, "UTC");
    assert.equal(ANALYTICS_BUCKET_TIMEZONE_POLICY.DAILY, "REPORTING_CALENDAR_DAY");
    assert.equal(ANALYTICS_BUCKET_TIMEZONE_POLICY.REPORTING_TIMEZONE, "Europe/Istanbul");
    assert.equal(ANALYTICS_BUCKET_TIMEZONE_POLICY.SERVER_LOCAL_FORBIDDEN, true);
    assert.equal(ANALYTICS_FRESHNESS_POLICY.NEAR_REAL_TIME_GUARANTEED, false);
    assert.equal(ANALYTICS_CONTENT_IDENTITY_POLICY.PRIMARY_KEY, "contentItemId");
    assert.equal(ANALYTICS_ENTITY_REPORTING.ENABLED, false);
    assert.equal(ANALYTICS_VIDEO_PLAY_REPORTING.AVAILABLE, false);
    assert.equal(ANALYTICS_SESSION_REPORTING.ENABLED, false);
    assert.equal(ANALYTICS_SESSION_REPORTING.REASON, "CONSENT_INTEGRATION_PENDING");
    assert.equal(ANALYTICS_AUTHOR_ATTRIBUTION.MODE, "FULL_CREDIT");
    assert.equal(ANALYTICS_CTR_POLICY.ZERO_IMPRESSIONS, null);
    assert.equal(ANALYTICS_CTR_POLICY.CLAMP_ABOVE_ONE, false);
  });
});

describe("computeAnalyticsAggregates", () => {
  it("counts HUMAN ARTICLE_VIEW once per eventId into hourly UTC and Istanbul daily buckets", () => {
    const batch = computeAnalyticsAggregates([
      fact({
        eventId: "e1",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
      }),
      fact({
        eventId: "e1",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
      }),
    ]);
    assert.equal(batch.quality.rawCountProcessed, 2);
    assert.equal(batch.quality.duplicateEventIdsSkipped, 1);
    assert.equal(batch.quality.eligibleCount, 1);
    assert.equal(batch.contentDaily[0]?.articleViews, 1);
    assert.equal(batch.contentHourly[0]?.articleViews, 1);
    assert.equal(
      batch.contentHourly[0]?.bucketStart.toISOString(),
      utcHourBucketStart(new Date("2026-08-21T10:15:00.000Z")).toISOString(),
    );
    assert.equal(
      batch.contentDaily[0]?.bucketStart.toISOString(),
      reportingDayBucketStart(new Date("2026-08-21T10:15:00.000Z")).toISOString(),
    );
  });

  it("places events just before Istanbul midnight into the previous reporting day", () => {
    const before = computeAnalyticsAggregates([
      fact({
        eventId: "before",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        occurredAt: new Date("2026-08-20T20:59:59.000Z"),
      }),
    ]);
    const after = computeAnalyticsAggregates([
      fact({
        eventId: "after",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        occurredAt: new Date("2026-08-20T21:00:00.000Z"),
      }),
    ]);
    assert.equal(before.contentDaily[0]?.bucketStart.toISOString(), "2026-08-19T21:00:00.000Z");
    assert.equal(after.contentDaily[0]?.bucketStart.toISOString(), "2026-08-20T21:00:00.000Z");
    assert.equal(before.contentHourly[0]?.bucketStart.toISOString(), "2026-08-20T20:00:00.000Z");
    assert.equal(after.contentHourly[0]?.bucketStart.toISOString(), "2026-08-20T21:00:00.000Z");
  });

  it("excludes BOT INTERNAL TEST and UNKNOWN from audience metrics", () => {
    const batch = computeAnalyticsAggregates([
      fact({
        eventId: "human",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        trafficKind: ANALYTICS_TRAFFIC_KIND.HUMAN,
      }),
      fact({
        eventId: "bot",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        trafficKind: ANALYTICS_TRAFFIC_KIND.BOT,
      }),
      fact({
        eventId: "internal",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        trafficKind: ANALYTICS_TRAFFIC_KIND.INTERNAL,
      }),
      fact({
        eventId: "test",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        trafficKind: ANALYTICS_TRAFFIC_KIND.TEST,
      }),
      fact({
        eventId: "unknown",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        trafficKind: ANALYTICS_TRAFFIC_KIND.UNKNOWN,
      }),
    ]);
    assert.equal(batch.contentDaily[0]?.articleViews, 1);
    assert.equal(batch.quality.eligibleCount, 1);
    assert.equal(batch.quality.excludedBotCount, 1);
    assert.equal(batch.quality.excludedInternalCount, 1);
    assert.equal(batch.quality.excludedTestCount, 1);
    assert.equal(batch.quality.excludedUnknownCount, 1);
  });

  it("keeps version A views on A after version B exists and sums lifetime by contentItemId", () => {
    const batch = computeAnalyticsAggregates([
      fact({
        eventId: "a1",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        publishedVersionId: VERSION_A,
      }),
      fact({
        eventId: "a2",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        publishedVersionId: VERSION_A,
      }),
      fact({
        eventId: "b1",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        publishedVersionId: VERSION_B,
      }),
    ]);
    const versionA = batch.contentDaily.find((row) => row.publishedVersionId === VERSION_A);
    const versionB = batch.contentDaily.find((row) => row.publishedVersionId === VERSION_B);
    assert.equal(versionA?.articleViews, 2);
    assert.equal(versionB?.articleViews, 1);
    assert.equal(
      batch.contentDaily
        .filter((row) => row.contentItemId === CONTENT_A)
        .reduce((sum, row) => sum + row.articleViews, 0),
      3,
    );
  });

  it("does not rewrite historical category or author when later identity would differ", () => {
    const batch = computeAnalyticsAggregates([
      fact({
        eventId: "cat",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        primaryCategoryId: CATEGORY_A,
        authorIds: [AUTHOR_1, AUTHOR_2],
      }),
    ]);
    assert.equal(batch.categoryDaily[0]?.primaryCategoryId, CATEGORY_A);
    assert.equal(batch.authorDaily.length, 2);
    assert.equal(batch.authorDaily[0]?.articleViews, 1);
    assert.equal(batch.authorDaily[1]?.articleViews, 1);
    assert.notEqual(
      batch.authorDaily.reduce((sum, row) => sum + row.articleViews, 0),
      batch.contentDaily[0]?.articleViews,
    );
  });

  it("aggregates homepage impressions and clicks without clamping CTR", () => {
    const batch = computeAnalyticsAggregates([
      fact({
        eventId: "imp",
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        placement: ANALYTICS_PLACEMENT.LEAD,
        position: 1,
        homepageVersionId: HOMEPAGE_V1,
      }),
      fact({
        eventId: "click1",
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK,
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        placement: ANALYTICS_PLACEMENT.LEAD,
        position: 1,
        homepageVersionId: HOMEPAGE_V1,
      }),
      fact({
        eventId: "click2",
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK,
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        placement: ANALYTICS_PLACEMENT.LEAD,
        position: 1,
        homepageVersionId: HOMEPAGE_V1,
      }),
    ]);
    assert.equal(batch.homepageSlotDaily[0]?.impressions, 1);
    assert.equal(batch.homepageSlotDaily[0]?.clicks, 2);
    assert.equal(batch.quality.clickGreaterThanImpressionAnomalyCount, 1);
    const ctr = reportingHomepageCtr(2, 1);
    assert.equal(ctr, 2);
    assert.equal(homepageCtr(1, 0), null);
    assert.equal(ANALYTICS_CTR_POLICY.CLAMP_ABOVE_ONE, false);
  });

  it("surfaces click-without-impression as an anomaly and zero-impression CTR as null", () => {
    const batch = computeAnalyticsAggregates([
      fact({
        eventId: "orphan-click",
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK,
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        placement: ANALYTICS_PLACEMENT.FEATURED_1,
        position: 3,
        homepageVersionId: HOMEPAGE_V1,
        contentItemId: CONTENT_B,
        publishedVersionId: VERSION_B,
      }),
    ]);
    assert.equal(batch.homepageSlotDaily[0]?.impressions, 0);
    assert.equal(batch.homepageSlotDaily[0]?.clicks, 1);
    assert.equal(batch.quality.clickWithoutImpressionAnomalyCount, 1);
    assert.equal(
      reportingHomepageCtr(
        batch.homepageSlotDaily[0]?.clicks ?? 0,
        batch.homepageSlotDaily[0]?.impressions ?? 0,
      ),
      null,
    );
  });

  it("aggregates recency fallback impressions independently from builder-slot impressions at the same position", () => {
    const batch = computeAnalyticsAggregates([
      fact({
        eventId: "builder-imp",
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        placement: ANALYTICS_PLACEMENT.LEAD,
        position: 1,
        homepageVersionId: HOMEPAGE_V1,
      }),
      fact({
        eventId: "fallback-imp",
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
        position: 1,
        homepageVersionId: null,
      }),
    ]);
    assert.equal(batch.homepageSlotDaily.length, 2);
    const builderRow = batch.homepageSlotDaily.find(
      (row) => row.placement === ANALYTICS_PLACEMENT.LEAD,
    );
    const fallbackRow = batch.homepageSlotDaily.find(
      (row) => row.placement === ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
    );
    assert.equal(builderRow?.impressions, 1);
    assert.equal(builderRow?.homepageVersionId, HOMEPAGE_V1);
    assert.equal(fallbackRow?.impressions, 1);
    assert.equal(fallbackRow?.homepageVersionId, null);
  });

  it("aggregates gallery and video impressions and ignores VIDEO_PLAY", () => {
    const batch = computeAnalyticsAggregates([
      fact({
        eventId: "open",
        eventName: ANALYTICS_EVENT_NAME.GALLERY_OPEN,
        mediaId: MEDIA_1,
        position: 1,
      }),
      fact({
        eventId: "view",
        eventName: ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW,
        mediaId: MEDIA_1,
        position: 1,
      }),
      fact({
        eventId: "vimp",
        eventName: ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION,
        videoAssetId: VIDEO_1,
        placement: ANALYTICS_PLACEMENT.ARTICLE_VIDEO,
      }),
      fact({
        eventId: "play",
        eventName: ANALYTICS_EVENT_NAME.VIDEO_PLAY,
        videoAssetId: VIDEO_1,
        placement: ANALYTICS_PLACEMENT.ARTICLE_VIDEO,
      }),
    ]);
    assert.equal(batch.contentDaily[0]?.galleryOpens, 1);
    assert.equal(batch.contentDaily[0]?.galleryImageViews, 1);
    assert.equal(batch.contentDaily[0]?.videoImpressions, 1);
    assert.equal(batch.mediaDaily[0]?.galleryImageViews, 1);
    assert.equal(batch.videoDaily[0]?.impressions, 1);
    assert.equal(batch.quality.videoPlayEventsIgnored, 1);
  });

  it("preserves source channel for eligible events and skips unsupported schema versions", () => {
    const batch = computeAnalyticsAggregates([
      fact({
        eventId: "search",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        trafficSource: ANALYTICS_TRAFFIC_SOURCE.SEARCH,
      }),
      fact({
        eventId: "direct",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        trafficSource: ANALYTICS_TRAFFIC_SOURCE.DIRECT,
        referrerHost: null,
      }),
      fact({
        eventId: "future",
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        schemaVersion: 99,
      }),
    ]);
    assert.equal(batch.sourceDaily.length, 2);
    assert.equal(batch.quality.unsupportedSchemaVersionCount, 1);
    assert.equal(batch.contentDaily[0]?.articleViews, 2);
  });
});

describe("analytics reporting period and comparison", () => {
  it("rejects inverted ranges, unknown metrics, and oversized hourly windows", () => {
    assert.equal(
      parseAnalyticsReportingPeriod({
        from: "2026-08-21",
        to: "2026-08-20",
        granularity: ANALYTICS_TIME_BUCKET.DAY,
      }).ok,
      false,
    );
    const hourly = parseAnalyticsReportingPeriod({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-03-01T00:00:00.000Z",
      granularity: ANALYTICS_TIME_BUCKET.HOUR,
    });
    assert.equal(hourly.ok, false);
    if (!hourly.ok) {
      assert.equal(hourly.code, ANALYTICS_REPORTING_ERROR.RANGE_TOO_LARGE);
    }
    assert.equal(parseAnalyticsReportingMetric("UNIQUE_VISITORS").ok, false);
    assert.equal(parseAnalyticsReportingMetric("SESSIONS").ok, false);
    assert.equal(parseAnalyticsReportingMetric(ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS).ok, true);
  });

  it("treats date-only bounds as Europe/Istanbul calendar days and never returns Infinity for percent change", () => {
    const period = parseAnalyticsReportingPeriod({
      from: "2026-08-01",
      to: "2026-08-01",
      granularity: ANALYTICS_TIME_BUCKET.DAY,
    });
    assert.equal(period.ok, true);
    if (period.ok) {
      assert.equal(period.value.fromInclusive.toISOString(), "2026-07-31T21:00:00.000Z");
      assert.equal(period.value.toExclusive.toISOString(), "2026-08-01T21:00:00.000Z");
    }
    assert.equal(compareAnalyticsCounts(8, 0).percentageChange, null);
    assert.equal(compareAnalyticsCounts(8, 4).percentageChange, 1);
  });

  it("aligns aggregation windows to reporting calendar days and rejects unbounded backfill", () => {
    const aligned = alignAnalyticsAggregationWindow({
      from: new Date("2026-08-21T15:00:00.000Z"),
      to: new Date("2026-08-22T10:00:00.000Z"),
    });
    assert.equal(aligned.ok, true);
    if (aligned.ok) {
      assert.equal(aligned.fromInclusive.toISOString(), "2026-08-20T21:00:00.000Z");
      assert.equal(aligned.toExclusive.toISOString(), "2026-08-22T21:00:00.000Z");
    }
    const tooWide = alignAnalyticsAggregationWindow({
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-03-15T00:00:00.000Z"),
    });
    assert.equal(tooWide.ok, false);
  });
});
