import {
  ANALYTICS_REPORTING_ERROR,
  ANALYTICS_TIME_BUCKET,
  isUuid,
  parseAnalyticsContentSort,
  parseAnalyticsMinImpressions,
  parseAnalyticsReportingLimit,
  parseAnalyticsReportingMetric,
  parseAnalyticsReportingPeriod,
  parseAnalyticsSourceChannel,
} from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";

function reportingHttpError(code: string): never {
  throw new EditorHttpError(400, code, "The request is invalid.");
}

export function parseAnalyticsReportQuery(url: URL) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const granularity =
    url.searchParams.get("granularity") ?? ANALYTICS_TIME_BUCKET.DAY;

  if (!from || !to) {
    reportingHttpError(ANALYTICS_REPORTING_ERROR.INVALID_RANGE);
  }

  const period = parseAnalyticsReportingPeriod({ from, to, granularity });
  if (!period.ok) {
    reportingHttpError(period.code);
  }

  const metric = parseAnalyticsReportingMetric(url.searchParams.get("metric"));
  if (!metric.ok) {
    reportingHttpError(metric.code);
  }

  const sort = parseAnalyticsContentSort(url.searchParams.get("sort"));
  if (!sort.ok) {
    reportingHttpError(sort.code);
  }

  const limit = parseAnalyticsReportingLimit(url.searchParams.get("limit"));
  if (!limit.ok) {
    reportingHttpError(limit.code);
  }

  const sourceChannel = parseAnalyticsSourceChannel(
    url.searchParams.get("sourceChannel"),
  );
  if (!sourceChannel.ok) {
    reportingHttpError(sourceChannel.code);
  }

  const categoryIdRaw = url.searchParams.get("categoryId");
  if (categoryIdRaw && !isUuid(categoryIdRaw)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return {
    period: period.value,
    metric: metric.value,
    sort: sort.value,
    limit: limit.value,
    minImpressions: parseAnalyticsMinImpressions(
      url.searchParams.get("minImpressions"),
    ),
    sourceChannel: sourceChannel.value,
    categoryId: categoryIdRaw,
    comparePrevious: url.searchParams.get("compare") === "previous",
  };
}

export function parseAnalyticsAggregateBody(body: unknown): {
  from?: Date;
  to?: Date;
} {
  if (body === null || body === undefined) {
    return {};
  }
  if (typeof body !== "object" || Array.isArray(body)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  const record = body as { from?: unknown; to?: unknown };
  if (record.from === undefined && record.to === undefined) {
    return {};
  }
  if (typeof record.from !== "string" || typeof record.to !== "string") {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  const from = new Date(record.from);
  const to = new Date(record.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return { from, to };
}
