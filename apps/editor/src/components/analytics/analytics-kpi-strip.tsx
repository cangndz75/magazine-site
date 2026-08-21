import {
  formatAnalyticsCount,
  formatAnalyticsCtr,
  formatAnalyticsDelta,
  presentMetricAvailability,
} from "@/lib/analytics/presentation";
import type { AnalyticsOverviewDto } from "@/lib/analytics/types";

type Kpi = {
  key: string;
  label: string;
  value: string;
  delta: ReturnType<typeof formatAnalyticsDelta>;
  unavailable: string | null;
};

export function AnalyticsKpiStrip({ overview }: { overview: AnalyticsOverviewDto }) {
  const kpis: Kpi[] = [
    {
      key: "articleViews",
      label: "Makale Görüntüleme",
      value: formatAnalyticsCount(overview.metrics.articleViews),
      delta: formatAnalyticsDelta(overview.comparison?.articleViews ?? null),
      unavailable: null,
    },
    {
      key: "homepageImpressions",
      label: "Anasayfa Gösterim",
      value: formatAnalyticsCount(overview.metrics.homepageImpressions),
      delta: null,
      unavailable: null,
    },
    {
      key: "homepageClicks",
      label: "Anasayfa Tıklama",
      value: formatAnalyticsCount(overview.metrics.homepageClicks),
      delta: formatAnalyticsDelta(overview.comparison?.homepageClicks ?? null),
      unavailable: null,
    },
    {
      key: "homepageCtr",
      label: "Anasayfa CTR",
      value: formatAnalyticsCtr(overview.metrics.homepageCtr),
      delta: null,
      unavailable: null,
    },
    {
      key: "galleryImageViews",
      label: "Galeri Görsel Görüntüleme",
      value: formatAnalyticsCount(overview.metrics.galleryImageViews),
      delta: null,
      unavailable: null,
    },
    {
      key: "videoImpressions",
      label: "Video Gösterim",
      value: formatAnalyticsCount(overview.metrics.videoImpressions),
      delta: null,
      unavailable: null,
    },
    {
      key: "sessions",
      label: "Oturumlar",
      value: "—",
      delta: null,
      unavailable: presentMetricAvailability(overview.metricAvailability.SESSIONS),
    },
    {
      key: "videoPlays",
      label: "Video Oynatma",
      value: "—",
      delta: null,
      unavailable: presentMetricAvailability(overview.metricAvailability.VIDEO_PLAYS),
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {kpis.map((kpi) => (
        <div
          key={kpi.key}
          className="rounded border border-zinc-200 bg-white p-3"
          data-unavailable={kpi.unavailable ? "true" : "false"}
        >
          <p className="truncate text-xs text-zinc-500">{kpi.label}</p>
          {kpi.unavailable ? (
            <p className="mt-1.5 text-xs font-medium text-zinc-400">{kpi.unavailable}</p>
          ) : (
            <>
              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
                {kpi.value}
              </p>
              {kpi.delta && (
                <p
                  className={`text-xs font-medium ${
                    kpi.delta.direction === "up"
                      ? "text-emerald-600"
                      : kpi.delta.direction === "down"
                        ? "text-red-600"
                        : "text-zinc-400"
                  }`}
                >
                  {kpi.delta.label}
                </p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
