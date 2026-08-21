"use client";

import Link from "next/link";
import { analyticsPageHref, type AnalyticsPageFilters } from "@/lib/analytics/page-params";
import { ANALYTICS_CHART_METRICS, ANALYTICS_METRIC_LABEL } from "@/lib/analytics/presentation";
import type { AnalyticsTimeSeriesDto } from "@/lib/analytics/types";
import { AnalyticsTimeSeriesChart } from "./analytics-timeseries-chart";

type Props = {
  filters: AnalyticsPageFilters;
  timeseries: AnalyticsTimeSeriesDto;
};

export function AnalyticsPrimaryChartSection({ filters, timeseries }: Props) {
  const metricLabel = ANALYTICS_METRIC_LABEL[filters.metric];
  const isEmpty = timeseries.points.every((point) => point.value === 0);

  return (
    <section className="mb-6 rounded border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">Zaman Serisi</h2>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Grafik metriği">
          {ANALYTICS_CHART_METRICS.map((metric) => (
            <Link
              key={metric}
              href={analyticsPageHref({ ...filters, metric })}
              aria-current={filters.metric === metric ? "true" : undefined}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                filters.metric === metric
                  ? "bg-pink-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {ANALYTICS_METRIC_LABEL[metric]}
            </Link>
          ))}
        </div>
      </div>

      {timeseries.freshness.status === "UNAVAILABLE" ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          {timeseries.freshness.reason === "AGGREGATION_FAILED"
            ? "Rapor verileri şu anda hazırlanamadı."
            : "Analytics verileri henüz toplanmadı."}
        </p>
      ) : (
        <>
          <AnalyticsTimeSeriesChart points={timeseries.points} metricLabel={metricLabel} />
          {isEmpty && (
            <p className="mt-2 text-center text-xs text-zinc-500">Bu dönemde görüntüleme yok.</p>
          )}
        </>
      )}
    </section>
  );
}
