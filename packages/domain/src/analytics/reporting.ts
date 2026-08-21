import { homepageCtr } from "./metrics";
import {
  ANALYTICS_CONTENT_SORT,
  ANALYTICS_CONTENT_SORTS,
  ANALYTICS_REPORTING_METRIC,
  ANALYTICS_REPORTING_METRICS,
  ANALYTICS_REPORTING_RANGE,
  ANALYTICS_REPORTING_TIMEZONE,
  ANALYTICS_SESSION_REPORTING,
  ANALYTICS_TIME_BUCKET,
  ANALYTICS_UNIQUE_VISITOR_REPORTING,
  ANALYTICS_VIDEO_PLAY_REPORTING,
  type AnalyticsContentSort,
  type AnalyticsReportingMetric,
  type AnalyticsTimeBucket,
} from "./aggregation-policy";
import {
  reportingDateToUtcRange,
  utcHourBucketStart,
} from "./buckets";
import type { AnalyticsTrafficSource } from "./taxonomy";
import { ANALYTICS_TRAFFIC_SOURCES } from "./taxonomy";

export const ANALYTICS_REPORTING_ERROR = {
  INVALID_RANGE: "INVALID_RANGE",
  RANGE_TOO_LARGE: "RANGE_TOO_LARGE",
  INVALID_GRANULARITY: "INVALID_GRANULARITY",
  INVALID_METRIC: "INVALID_METRIC",
  INVALID_LIMIT: "INVALID_LIMIT",
  INVALID_SORT: "INVALID_SORT",
  INVALID_SOURCE: "INVALID_SOURCE",
} as const;

export type AnalyticsReportingErrorCode =
  (typeof ANALYTICS_REPORTING_ERROR)[keyof typeof ANALYTICS_REPORTING_ERROR];

export type AnalyticsReportingDecision<T> =
  | { ok: true; value: T }
  | { ok: false; code: AnalyticsReportingErrorCode };

export type AnalyticsReportingPeriod = {
  fromInclusive: Date;
  toExclusive: Date;
  granularity: AnalyticsTimeBucket;
};

export const ANALYTICS_METRIC_AVAILABILITY_REASON = {
  MEASUREMENT_NOT_ENABLED: "MEASUREMENT_NOT_ENABLED",
  CONSENT_INTEGRATION_PENDING: "CONSENT_INTEGRATION_PENDING",
  VIDEO_PLAY_DEFERRED: "VIDEO_PLAY_DEFERRED",
  DURABLE_VISITOR_ID_DISABLED: "DURABLE_VISITOR_ID_DISABLED",
  AGGREGATION_PENDING: "AGGREGATION_PENDING",
  AGGREGATION_FAILED: "AGGREGATION_FAILED",
} as const;

export type AnalyticsMetricAvailabilityReason =
  (typeof ANALYTICS_METRIC_AVAILABILITY_REASON)[keyof typeof ANALYTICS_METRIC_AVAILABILITY_REASON];

export type AnalyticsResolvedMetricAvailability =
  | { status: "AVAILABLE" }
  | { status: "UNAVAILABLE"; reason: AnalyticsMetricAvailabilityReason };

export const ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY = {
  ARTICLE_VIEWS: { status: "AVAILABLE" },
  HOMEPAGE_IMPRESSIONS: { status: "AVAILABLE" },
  HOMEPAGE_CLICKS: { status: "AVAILABLE" },
  SESSIONS: {
    status: "UNAVAILABLE",
    reason: ANALYTICS_METRIC_AVAILABILITY_REASON.CONSENT_INTEGRATION_PENDING,
  },
  UNIQUE_VISITORS: {
    status: "UNAVAILABLE",
    reason: ANALYTICS_METRIC_AVAILABILITY_REASON.DURABLE_VISITOR_ID_DISABLED,
  },
  VIDEO_PLAYS: {
    status: "UNAVAILABLE",
    reason: ANALYTICS_METRIC_AVAILABILITY_REASON.VIDEO_PLAY_DEFERRED,
  },
} as const satisfies Record<string, AnalyticsResolvedMetricAvailability>;

export type AnalyticsMetricAvailability = {
  VIDEO_PLAYS: typeof ANALYTICS_VIDEO_PLAY_REPORTING;
  UNIQUE_VISITORS: typeof ANALYTICS_UNIQUE_VISITOR_REPORTING;
  SESSIONS: typeof ANALYTICS_SESSION_REPORTING;
};

export const ANALYTICS_METRIC_AVAILABILITY: AnalyticsMetricAvailability = {
  VIDEO_PLAYS: ANALYTICS_VIDEO_PLAY_REPORTING,
  UNIQUE_VISITORS: ANALYTICS_UNIQUE_VISITOR_REPORTING,
  SESSIONS: ANALYTICS_SESSION_REPORTING,
};

export function resolveAnalyticsMetricAvailability(input: {
  measurement: AnalyticsResolvedMetricAvailability;
  freshness: AnalyticsFreshnessState;
}): AnalyticsResolvedMetricAvailability {
  if (input.measurement.status === "UNAVAILABLE") {
    return input.measurement;
  }
  if (input.freshness.status === "UNAVAILABLE") {
    return {
      status: "UNAVAILABLE",
      reason: input.freshness.reason,
    };
  }
  return { status: "AVAILABLE" };
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoBoundary(
  raw: string,
  role: "from" | "to",
): Date | null {
  const dateOnly = DATE_ONLY.exec(raw);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const range = reportingDateToUtcRange(
      year,
      month,
      day,
      ANALYTICS_REPORTING_TIMEZONE,
    );
    if (
      range.fromInclusive.getUTCFullYear() < 2000 ||
      Number.isNaN(range.fromInclusive.getTime())
    ) {
      return null;
    }
    return role === "to" ? range.toExclusive : range.fromInclusive;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  if (!raw.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(raw)) {
    return null;
  }
  return parsed;
}

export function parseAnalyticsReportingPeriod(input: {
  from: string;
  to: string;
  granularity: string;
}): AnalyticsReportingDecision<AnalyticsReportingPeriod> {
  if (
    input.granularity !== ANALYTICS_TIME_BUCKET.HOUR &&
    input.granularity !== ANALYTICS_TIME_BUCKET.DAY
  ) {
    return { ok: false, code: ANALYTICS_REPORTING_ERROR.INVALID_GRANULARITY };
  }

  const fromInclusive = parseIsoBoundary(input.from, "from");
  const toExclusive = parseIsoBoundary(input.to, "to");
  if (!fromInclusive || !toExclusive) {
    return { ok: false, code: ANALYTICS_REPORTING_ERROR.INVALID_RANGE };
  }
  if (fromInclusive.getTime() >= toExclusive.getTime()) {
    return { ok: false, code: ANALYTICS_REPORTING_ERROR.INVALID_RANGE };
  }

  const durationMs = toExclusive.getTime() - fromInclusive.getTime();
  const maxDays =
    input.granularity === ANALYTICS_TIME_BUCKET.HOUR
      ? ANALYTICS_REPORTING_RANGE.HOURLY_MAX_DAYS
      : ANALYTICS_REPORTING_RANGE.DAILY_MAX_DAYS;
  if (durationMs > maxDays * 24 * 60 * 60 * 1000) {
    return { ok: false, code: ANALYTICS_REPORTING_ERROR.RANGE_TOO_LARGE };
  }

  return {
    ok: true,
    value: {
      fromInclusive:
        input.granularity === ANALYTICS_TIME_BUCKET.HOUR
          ? utcHourBucketStart(fromInclusive)
          : fromInclusive,
      toExclusive,
      granularity: input.granularity,
    },
  };
}

export function parseAnalyticsReportingMetric(
  raw: string | null | undefined,
): AnalyticsReportingDecision<AnalyticsReportingMetric> {
  const value = raw ?? ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS;
  if (
    !ANALYTICS_REPORTING_METRICS.includes(value as AnalyticsReportingMetric)
  ) {
    return { ok: false, code: ANALYTICS_REPORTING_ERROR.INVALID_METRIC };
  }
  return { ok: true, value: value as AnalyticsReportingMetric };
}

export function parseAnalyticsContentSort(
  raw: string | null | undefined,
): AnalyticsReportingDecision<AnalyticsContentSort> {
  const value = raw ?? ANALYTICS_CONTENT_SORT.ARTICLE_VIEWS;
  if (!ANALYTICS_CONTENT_SORTS.includes(value as AnalyticsContentSort)) {
    return { ok: false, code: ANALYTICS_REPORTING_ERROR.INVALID_SORT };
  }
  return { ok: true, value: value as AnalyticsContentSort };
}

export function parseAnalyticsReportingLimit(
  raw: string | null | undefined,
): AnalyticsReportingDecision<number> {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: ANALYTICS_REPORTING_RANGE.DEFAULT_LIMIT };
  }
  const parsed = Number.parseInt(raw, 10);
  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > ANALYTICS_REPORTING_RANGE.MAX_LIMIT
  ) {
    return { ok: false, code: ANALYTICS_REPORTING_ERROR.INVALID_LIMIT };
  }
  return { ok: true, value: parsed };
}

export function parseAnalyticsSourceChannel(
  raw: string | null | undefined,
): AnalyticsReportingDecision<AnalyticsTrafficSource | null> {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  if (
    !ANALYTICS_TRAFFIC_SOURCES.includes(raw as AnalyticsTrafficSource)
  ) {
    return { ok: false, code: ANALYTICS_REPORTING_ERROR.INVALID_SOURCE };
  }
  return { ok: true, value: raw as AnalyticsTrafficSource };
}

export function parseAnalyticsMinImpressions(
  raw: string | null | undefined,
): number {
  if (raw === null || raw === undefined || raw === "") {
    return ANALYTICS_REPORTING_RANGE.DEFAULT_CTR_MIN_IMPRESSIONS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return ANALYTICS_REPORTING_RANGE.DEFAULT_CTR_MIN_IMPRESSIONS;
  }
  return parsed;
}

export function reportingHomepageCtr(
  clicks: number,
  impressions: number,
): number | null {
  return homepageCtr(clicks, impressions);
}

export type AnalyticsPeriodComparison = {
  current: number;
  previous: number;
  delta: number;
  percentageChange: number | null;
};

/**
 * previous = 0 and current > 0 → percentageChange is null (new / undefined).
 * Never Infinity.
 */
export function compareAnalyticsCounts(
  current: number,
  previous: number,
): AnalyticsPeriodComparison {
  const delta = current - previous;
  if (previous === 0) {
    return { current, previous, delta, percentageChange: null };
  }
  return {
    current,
    previous,
    delta,
    percentageChange: delta / previous,
  };
}

export function previousAnalyticsPeriod(period: AnalyticsReportingPeriod): {
  fromInclusive: Date;
  toExclusive: Date;
} {
  const duration = period.toExclusive.getTime() - period.fromInclusive.getTime();
  return {
    fromInclusive: new Date(period.fromInclusive.getTime() - duration),
    toExclusive: period.fromInclusive,
  };
}

export type AnalyticsFreshnessState =
  | {
      status: "AVAILABLE";
      lastSuccessfulThrough: Date;
      lastCompletedAt: Date;
    }
  | {
      status: "UNAVAILABLE";
      reason: "AGGREGATION_PENDING" | "AGGREGATION_FAILED";
      lastSuccessfulThrough: Date | null;
      lastErrorSafeSummary: string | null;
    };

export function analyticsReportingLeaksSensitiveMaterial(
  payload: unknown,
): boolean {
  const serialized = JSON.stringify(payload);
  const forbidden = [
    "storageKey",
    "internalNote",
    "passwordHash",
    "recoveryCode",
    "totp",
    "sessionToken",
    "factFingerprint",
    "properties",
    "eventId",
    "anonymousSessionId",
  ];
  return forbidden.some((key) => serialized.includes(`"${key}"`));
}
