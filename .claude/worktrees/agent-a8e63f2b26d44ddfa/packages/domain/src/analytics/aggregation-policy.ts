import { ANALYTICS_EVENT_NAME } from "./taxonomy";
import { ANALYTICS_TAXONOMY_VERSION, VIDEO_PLAY_MEASUREMENT } from "./policy";
import { isDefaultAudienceTrafficKind } from "./metrics";
import { nextReportingDayBucketStart, reportingDayBucketStart } from "./buckets";
import type { AnalyticsTrafficKind } from "./taxonomy";

/**
 * Derived reporting is never source-of-truth. Accepted raw events remain
 * the authority. Duplicate eventId must never double-count.
 */
export const ANALYTICS_AGGREGATION_GUARANTEES = {
  RAW_EVENTS_ARE_SOURCE_OF_TRUTH: true,
  AGGREGATES_ARE_DERIVED: true,
  DEDUPE: "EVENT_ID",
  DEFAULT_AUDIENCE: "HUMAN_ONLY_VIA_isDefaultAudienceTrafficKind",
  LATE_AND_OUT_OF_ORDER: "TOLERATED_BY_WINDOW_RECOMPUTE",
  WINDOW_RERUN: "IDEMPOTENT_REPLACE",
  CORRUPTION_RECOVERY: "RECOMPUTE_FROM_RAW",
  DASHBOARD_MUST_NOT_SCAN_UNBOUNDED_RAW: true,
  METRIC_SEMANTICS: "TAXONOMY_VERSION_AWARE",
} as const;

/**
 * Aggregation only interprets known taxonomy versions. Future payloads
 * are skipped with an operational count, never silently reinterpreted.
 */
export const ANALYTICS_AGGREGATION_SUPPORTED_SCHEMA_VERSIONS = [
  ANALYTICS_TAXONOMY_VERSION,
] as const;

export const ANALYTICS_AGGREGATION_JOB_NAME = "analytics.aggregate.v1";

/**
 * Late-arrival lookback for the periodic recompute window.
 * Events older than this remain recoverable only via explicit backfill.
 */
export const ANALYTICS_LATE_ARRIVAL_LOOKBACK = {
  HOURS: 48,
  MS: 48 * 60 * 60 * 1000,
} as const;

export const ANALYTICS_AGGREGATION_WINDOW = {
  MAX_BACKFILL_DAYS: 31,
  MAX_BACKFILL_MS: 31 * 24 * 60 * 60 * 1000,
} as const;

export const ANALYTICS_TIME_BUCKET = {
  HOUR: "HOUR",
  DAY: "DAY",
} as const;

export type AnalyticsTimeBucket =
  (typeof ANALYTICS_TIME_BUCKET)[keyof typeof ANALYTICS_TIME_BUCKET];

/**
 * Hourly buckets are UTC instants.
 * Daily buckets are reporting-calendar days in ANALYTICS_REPORTING_TIMEZONE.
 * The stored timestamp is the local midnight converted to UTC, never a
 * relabeled UTC calendar day and never the machine local timezone.
 */
export const ANALYTICS_REPORTING_TIMEZONE = "Europe/Istanbul";

export const ANALYTICS_BUCKET_TIMEZONE_POLICY = {
  STORAGE_INSTANT: "UTC",
  HOURLY: "UTC",
  DAILY: "REPORTING_CALENDAR_DAY",
  REPORTING_TIMEZONE: ANALYTICS_REPORTING_TIMEZONE,
  SERVER_LOCAL_FORBIDDEN: true,
} as const;

export const ANALYTICS_FRESHNESS_POLICY = {
  NEAR_REAL_TIME_GUARANTEED: false,
  LABEL: "son güncelleme",
  DEFAULT_MODE: "ON_DEMAND_OR_PERIODIC_RECOMPUTE",
  MISSING_AGGREGATES: "EXPLICIT_UNAVAILABLE_NOT_RAW_SCAN",
} as const;

export const ANALYTICS_AUTHOR_ATTRIBUTION = {
  MODE: "FULL_CREDIT",
  DESCRIPTION:
    "One ARTICLE_VIEW increments each credited author by 1. Author totals must not be assumed equal to article totals.",
} as const;

export const ANALYTICS_ENTITY_REPORTING = {
  ENABLED: false,
  REASON: "entityIds are not a v1 reporting dimension on stored facts",
} as const;

export const ANALYTICS_CAMPAIGN_REPORTING = {
  ENABLED: false,
  REASON: "bounded UTM exists on some events but is not a v1 aggregate dimension",
} as const;

export const ANALYTICS_UNIQUE_VISITOR_REPORTING = {
  ENABLED: false,
  REASON: "durable visitor IDs are disabled in v1",
  MUST_NOT_LABEL_AS: "unique people",
} as const;

export const ANALYTICS_SESSION_REPORTING = {
  ENABLED: false,
  COMPOSABLE_ACROSS_DAYS: false,
  REASON: "CONSENT_INTEGRATION_PENDING",
  DESCRIPTION:
    "Session cookies are consent-gated and no consent UI exists yet. Do not report SESSIONS as a measured 0.",
} as const;

export const ANALYTICS_VIDEO_PLAY_REPORTING = {
  AVAILABLE: false,
  STATUS: VIDEO_PLAY_MEASUREMENT.STATUS,
  REASON: VIDEO_PLAY_MEASUREMENT.REASON,
} as const;

export const ANALYTICS_CTR_POLICY = {
  FORMULA: "clicks / impressions",
  ZERO_IMPRESSIONS: null,
  CLAMP_ABOVE_ONE: false,
  STORE_RATIO: false,
  CLICK_GREATER_THAN_IMPRESSION: "DATA_QUALITY_ANOMALY_NOT_DB_CONSTRAINT",
} as const;

export const ANALYTICS_REPORTING_RANGE = {
  HOURLY_MAX_DAYS: 31,
  DAILY_MAX_DAYS: 366,
  DEFAULT_LIMIT: 25,
  MAX_LIMIT: 100,
  DEFAULT_CTR_MIN_IMPRESSIONS: 20,
} as const;

export const ANALYTICS_REPORTING_METRIC = {
  ARTICLE_VIEWS: "ARTICLE_VIEWS",
  HOMEPAGE_IMPRESSIONS: "HOMEPAGE_IMPRESSIONS",
  HOMEPAGE_CLICKS: "HOMEPAGE_CLICKS",
  HOMEPAGE_CTR: "HOMEPAGE_CTR",
  GALLERY_OPENS: "GALLERY_OPENS",
  GALLERY_IMAGE_VIEWS: "GALLERY_IMAGE_VIEWS",
  VIDEO_IMPRESSIONS: "VIDEO_IMPRESSIONS",
} as const;

export type AnalyticsReportingMetric =
  (typeof ANALYTICS_REPORTING_METRIC)[keyof typeof ANALYTICS_REPORTING_METRIC];

export const ANALYTICS_REPORTING_METRICS = Object.values(
  ANALYTICS_REPORTING_METRIC,
);

export const ANALYTICS_UNAVAILABLE_METRICS = {
  VIDEO_PLAYS: ANALYTICS_VIDEO_PLAY_REPORTING,
  UNIQUE_VISITORS: ANALYTICS_UNIQUE_VISITOR_REPORTING,
  SESSIONS: ANALYTICS_SESSION_REPORTING,
} as const;

export const ANALYTICS_CONTENT_SORT = {
  ARTICLE_VIEWS: "ARTICLE_VIEWS",
  HOMEPAGE_CLICKS: "HOMEPAGE_CLICKS",
  HOMEPAGE_CTR: "HOMEPAGE_CTR",
} as const;

export type AnalyticsContentSort =
  (typeof ANALYTICS_CONTENT_SORT)[keyof typeof ANALYTICS_CONTENT_SORT];

export const ANALYTICS_CONTENT_SORTS = Object.values(ANALYTICS_CONTENT_SORT);

export const ANALYTICS_AGGREGATION_EVENT_NAMES = {
  ARTICLE_VIEW: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
  HOMEPAGE_CONTENT_IMPRESSION: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
  HOMEPAGE_CONTENT_CLICK: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK,
  GALLERY_OPEN: ANALYTICS_EVENT_NAME.GALLERY_OPEN,
  GALLERY_IMAGE_VIEW: ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW,
  VIDEO_IMPRESSION: ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION,
  HOMEPAGE_VIEW: ANALYTICS_EVENT_NAME.HOMEPAGE_VIEW,
} as const;

export function analyticsSchemaVersionIsSupported(
  schemaVersion: number,
): boolean {
  return (
    schemaVersion === ANALYTICS_TAXONOMY_VERSION &&
    ANALYTICS_AGGREGATION_SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)
  );
}

export function analyticsFactIsMetricEligible(trafficKind: AnalyticsTrafficKind): boolean {
  return isDefaultAudienceTrafficKind(trafficKind);
}

export function analyticsLateArrivalFrom(now: Date): Date {
  return new Date(now.getTime() - ANALYTICS_LATE_ARRIVAL_LOOKBACK.MS);
}

export function alignAnalyticsAggregationWindow(input: {
  from: Date;
  to: Date;
}):
  | { ok: true; fromInclusive: Date; toExclusive: Date }
  | { ok: false; code: "INVALID_RANGE" | "RANGE_TOO_LARGE" } {
  if (
    Number.isNaN(input.from.getTime()) ||
    Number.isNaN(input.to.getTime()) ||
    input.from.getTime() >= input.to.getTime()
  ) {
    return { ok: false, code: "INVALID_RANGE" };
  }

  const fromInclusive = reportingDayBucketStart(input.from);
  const toDayStart = reportingDayBucketStart(input.to);
  const toExclusive =
    toDayStart.getTime() < input.to.getTime()
      ? nextReportingDayBucketStart(toDayStart)
      : toDayStart;

  if (fromInclusive.getTime() >= toExclusive.getTime()) {
    return { ok: false, code: "INVALID_RANGE" };
  }
  if (
    toExclusive.getTime() - fromInclusive.getTime() >
    ANALYTICS_AGGREGATION_WINDOW.MAX_BACKFILL_MS
  ) {
    return { ok: false, code: "RANGE_TOO_LARGE" };
  }
  return { ok: true, fromInclusive, toExclusive };
}
