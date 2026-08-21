"use client";

import Link from "next/link";
import {
  ANALYTICS_RANGE_PRESET,
  analyticsPageHref,
  type AnalyticsPageFilters,
} from "@/lib/analytics/page-params";
import {
  ANALYTICS_REPORTING_TIMEZONE_LABEL,
  presentAnalyticsFreshness,
} from "@/lib/analytics/presentation";
import type { AnalyticsFreshnessDto } from "@/lib/analytics/types";

const FRESHNESS_TONE_CLASS: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

type Props = {
  filters: AnalyticsPageFilters;
  freshness: AnalyticsFreshnessDto;
  rangeInvalid: boolean;
};

export function AnalyticsReportHeader({ filters, freshness, rangeInvalid }: Props) {
  const presentation = presentAnalyticsFreshness(freshness);

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Yayın performansını, içerik dağılımını ve trafik kaynaklarını izleyin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center overflow-hidden rounded border border-zinc-300 bg-white text-sm">
            <Link
              href={analyticsPageHref({
                ...filters,
                preset: ANALYTICS_RANGE_PRESET.LAST_7_DAYS,
                from: undefined,
                to: undefined,
              })}
              className={`px-3 py-1.5 font-medium ${
                filters.preset === ANALYTICS_RANGE_PRESET.LAST_7_DAYS
                  ? "bg-pink-600 text-white"
                  : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Son 7 gün
            </Link>
            <Link
              href={analyticsPageHref({
                ...filters,
                preset: ANALYTICS_RANGE_PRESET.LAST_30_DAYS,
                from: undefined,
                to: undefined,
              })}
              className={`border-l border-zinc-300 px-3 py-1.5 font-medium ${
                filters.preset === ANALYTICS_RANGE_PRESET.LAST_30_DAYS
                  ? "bg-pink-600 text-white"
                  : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Son 30 gün
            </Link>
          </div>
          <Link
            href={analyticsPageHref({ ...filters, compare: !filters.compare })}
            className={`rounded border px-3 py-1.5 text-sm font-medium ${
              filters.compare
                ? "border-pink-300 bg-pink-50 text-pink-700"
                : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
            aria-pressed={filters.compare}
          >
            Önceki dönemle kıyasla
          </Link>
        </div>
      </div>

      {rangeInvalid && (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Belirtilen tarih aralığı geçersiz olduğu için son 7 gün gösteriliyor.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span
          className={`rounded border px-2 py-1 font-medium ${FRESHNESS_TONE_CLASS[presentation.tone]}`}
        >
          {presentation.label}
        </span>
        <span>{ANALYTICS_REPORTING_TIMEZONE_LABEL}</span>
        <span>
          {filters.from} – {filters.to}
        </span>
      </div>
    </div>
  );
}
