import {
  ANALYTICS_CONTENT_SORT,
  ANALYTICS_REPORTING_METRIC,
  ANALYTICS_REPORTING_TIMEZONE,
  ANALYTICS_TIME_BUCKET,
  parseAnalyticsContentSort,
  parseAnalyticsReportingMetric,
  parseAnalyticsReportingPeriod,
  reportingCalendarDate,
  type AnalyticsContentSort,
  type AnalyticsReportingMetric,
  type AnalyticsReportingPeriod,
} from "@magazine/domain";
import { ANALYTICS_CHART_METRICS } from "./presentation";

export const ANALYTICS_RANGE_PRESET = {
  LAST_7_DAYS: "7d",
  LAST_30_DAYS: "30d",
} as const;

export type AnalyticsRangePreset =
  (typeof ANALYTICS_RANGE_PRESET)[keyof typeof ANALYTICS_RANGE_PRESET];

const RANGE_PRESET_DAYS: Record<AnalyticsRangePreset, number> = {
  [ANALYTICS_RANGE_PRESET.LAST_7_DAYS]: 7,
  [ANALYTICS_RANGE_PRESET.LAST_30_DAYS]: 30,
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type AnalyticsPageFilters = {
  /** Preset used to derive from/to, or null when the range came from explicit custom dates. */
  preset: AnalyticsRangePreset | null;
  from: string;
  to: string;
  metric: AnalyticsReportingMetric;
  sort: AnalyticsContentSort;
  compare: boolean;
};

export type AnalyticsPageReport = {
  filters: AnalyticsPageFilters;
  period: AnalyticsReportingPeriod;
  rangeInvalid: boolean;
};

/** Pure calendar-date arithmetic (Y/M/D only) — safe across DST, unlike instant-ms shifting. */
function shiftDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export function parseAnalyticsPageSearchParams(
  params: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): AnalyticsPageReport {
  const today = reportingCalendarDate(now, ANALYTICS_REPORTING_TIMEZONE);

  const rawFrom = readParam(params, "from");
  const rawTo = readParam(params, "to");
  const rawPreset = readParam(params, "preset");

  let preset: AnalyticsRangePreset | null = null;
  let from: string;
  let to: string;

  if (rawFrom && rawTo && DATE_ONLY.test(rawFrom) && DATE_ONLY.test(rawTo)) {
    from = rawFrom;
    to = rawTo;
  } else {
    preset =
      rawPreset === ANALYTICS_RANGE_PRESET.LAST_30_DAYS
        ? ANALYTICS_RANGE_PRESET.LAST_30_DAYS
        : ANALYTICS_RANGE_PRESET.LAST_7_DAYS;
    to = today;
    from = shiftDateOnly(today, -(RANGE_PRESET_DAYS[preset] - 1));
  }

  const metricDecision = parseAnalyticsReportingMetric(readParam(params, "metric"));
  const metric =
    metricDecision.ok && ANALYTICS_CHART_METRICS.includes(metricDecision.value)
      ? metricDecision.value
      : ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS;

  const sortDecision = parseAnalyticsContentSort(readParam(params, "sort"));
  const sort = sortDecision.ok ? sortDecision.value : ANALYTICS_CONTENT_SORT.ARTICLE_VIEWS;

  const compare = readParam(params, "compare") !== "off";

  const periodDecision = parseAnalyticsReportingPeriod({
    from,
    to,
    granularity: ANALYTICS_TIME_BUCKET.DAY,
  });

  if (!periodDecision.ok) {
    // Fail safe: fall back to the default 7-day window rather than surfacing a raw error.
    preset = ANALYTICS_RANGE_PRESET.LAST_7_DAYS;
    to = today;
    from = shiftDateOnly(today, -6);
    const fallback = parseAnalyticsReportingPeriod({
      from,
      to,
      granularity: ANALYTICS_TIME_BUCKET.DAY,
    });
    return {
      filters: { preset, from, to, metric, sort, compare },
      period: (fallback as { ok: true; value: AnalyticsReportingPeriod }).value,
      rangeInvalid: true,
    };
  }

  return {
    filters: { preset, from, to, metric, sort, compare },
    period: periodDecision.value,
    rangeInvalid: false,
  };
}

export function analyticsPageHref(filters: Partial<AnalyticsPageFilters>): string {
  const params = new URLSearchParams();
  if (filters.preset) {
    params.set("preset", filters.preset);
  } else if (filters.from && filters.to) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  }
  if (filters.metric && filters.metric !== ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS) {
    params.set("metric", filters.metric);
  }
  if (filters.sort && filters.sort !== ANALYTICS_CONTENT_SORT.ARTICLE_VIEWS) {
    params.set("sort", filters.sort);
  }
  if (filters.compare === false) {
    params.set("compare", "off");
  }
  const qs = params.toString();
  return qs ? `/analytics?${qs}` : "/analytics";
}
