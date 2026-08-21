import type { SuperAdminDashboardDto } from "@magazine/db/editor";
import { formatAnalyticsCount, formatAnalyticsDelta } from "@/lib/analytics/presentation";
import { formatDashboardCount } from "@/lib/dashboard/dashboard-presentation";
import type { AnalyticsComparisonDto } from "@/lib/analytics/types";

type StripMetric = {
  key: string;
  label: string;
  value: string | null;
  delta: { label: string; direction: "up" | "down" | "flat" | "new" } | null;
  unavailable: boolean;
};

export function DashboardExecStrip({ dashboard }: { dashboard: SuperAdminDashboardDto }) {
  const metrics: StripMetric[] = [
    {
      key: "published",
      label: "Yayında",
      value:
        dashboard.editorial.status === "AVAILABLE"
          ? formatDashboardCount(dashboard.editorial.data.published)
          : null,
      delta: null,
      unavailable: dashboard.editorial.status !== "AVAILABLE",
    },
    {
      key: "inReview",
      label: "İncelemede",
      value:
        dashboard.editorial.status === "AVAILABLE"
          ? formatDashboardCount(dashboard.editorial.data.inReview)
          : null,
      delta: null,
      unavailable: dashboard.editorial.status !== "AVAILABLE",
    },
    {
      key: "scheduled",
      label: "Zamanlanan",
      value:
        dashboard.editorial.status === "AVAILABLE"
          ? formatDashboardCount(dashboard.editorial.data.scheduled)
          : null,
      delta: null,
      unavailable: dashboard.editorial.status !== "AVAILABLE",
    },
    {
      key: "attention",
      label: "Dikkat Gerektiren",
      value:
        dashboard.attention.status === "AVAILABLE"
          ? formatDashboardCount(dashboard.attention.data.total)
          : null,
      delta: null,
      unavailable: dashboard.attention.status !== "AVAILABLE",
    },
    {
      key: "articleViews",
      label: "7 Günlük Görüntülenme",
      value:
        dashboard.analytics.status === "AVAILABLE"
          ? formatAnalyticsCount(dashboard.analytics.data.metrics.articleViews)
          : null,
      delta:
        dashboard.analytics.status === "AVAILABLE"
          ? formatAnalyticsDelta(
              (dashboard.analytics.data.comparison as { articleViews: AnalyticsComparisonDto } | null)
                ?.articleViews ?? null,
            )
          : null,
      unavailable: dashboard.analytics.status !== "AVAILABLE",
    },
    {
      key: "staff",
      label: "Aktif Personel",
      value:
        dashboard.staffSecurity.status === "AVAILABLE"
          ? formatDashboardCount(dashboard.staffSecurity.data.active)
          : null,
      delta: null,
      unavailable: dashboard.staffSecurity.status !== "AVAILABLE",
    },
  ];

  return (
    <div
      role="list"
      aria-label="Yönetim özeti"
      className="mb-5 grid grid-cols-2 divide-x divide-y divide-zinc-200 border border-zinc-200 bg-white sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6"
    >
      {metrics.map((metric) => (
        <div key={metric.key} role="listitem" className="px-4 py-3">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {metric.label}
          </p>
          {metric.unavailable ? (
            <p className="mt-1.5 text-xs font-medium text-zinc-400">Kullanılamıyor</p>
          ) : (
            <div className="mt-1 flex items-baseline gap-1.5">
              <p className="text-xl font-semibold tabular-nums text-zinc-950">{metric.value}</p>
              {metric.delta && (
                <span
                  className={`text-xs font-medium ${
                    metric.delta.direction === "up"
                      ? "text-emerald-700"
                      : metric.delta.direction === "down"
                        ? "text-rose-700"
                        : "text-zinc-400"
                  }`}
                >
                  {metric.delta.label}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
