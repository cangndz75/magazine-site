import type { DashboardSection, SuperAdminAnalyticsSummary } from "@magazine/db/editor";
import { DashboardSectionShell } from "./dashboard-section-shell";
import {
  formatAnalyticsCount,
  formatAnalyticsCtr,
  formatAnalyticsDelta,
  presentAnalyticsFreshness,
} from "@/lib/analytics/presentation";
import type { AnalyticsComparisonDto, AnalyticsFreshnessDto } from "@/lib/analytics/types";

const FRESHNESS_TONE_CLASS: Record<string, string> = {
  ok: "text-emerald-700",
  pending: "text-amber-700",
  failed: "text-rose-700",
};

export function DashboardAnalyticsSnapshot({
  section,
}: {
  section: DashboardSection<SuperAdminAnalyticsSummary>;
}) {
  return (
    <DashboardSectionShell title="Analytics" section={section} action={{ href: "/analytics", label: "Analytics" }}>
      {(data) => {
        const freshness = presentAnalyticsFreshness(data.freshness as AnalyticsFreshnessDto);
        const comparison = data.comparison as {
          articleViews: AnalyticsComparisonDto;
          homepageClicks: AnalyticsComparisonDto;
        } | null;
        const articleViewsDelta = formatAnalyticsDelta(comparison?.articleViews ?? null);
        const clicksDelta = formatAnalyticsDelta(comparison?.homepageClicks ?? null);

        return (
          <div>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-zinc-500">Makale Görüntüleme</dt>
                <dd className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-semibold tabular-nums text-zinc-950">
                    {formatAnalyticsCount(data.metrics.articleViews)}
                  </span>
                  {articleViewsDelta && (
                    <span
                      className={`text-xs font-medium ${
                        articleViewsDelta.direction === "up"
                          ? "text-emerald-700"
                          : articleViewsDelta.direction === "down"
                            ? "text-rose-700"
                            : "text-zinc-400"
                      }`}
                    >
                      {articleViewsDelta.label}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Anasayfa Gösterim</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-950">
                  {formatAnalyticsCount(data.metrics.homepageImpressions)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Anasayfa Tıklama</dt>
                <dd className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-semibold tabular-nums text-zinc-950">
                    {formatAnalyticsCount(data.metrics.homepageClicks)}
                  </span>
                  {clicksDelta && (
                    <span
                      className={`text-xs font-medium ${
                        clicksDelta.direction === "up"
                          ? "text-emerald-700"
                          : clicksDelta.direction === "down"
                            ? "text-rose-700"
                            : "text-zinc-400"
                      }`}
                    >
                      {clicksDelta.label}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Anasayfa CTR</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-950">
                  {formatAnalyticsCtr(data.metrics.homepageCtr)}
                </dd>
              </div>
            </dl>
            <p className={`mt-3 text-xs font-medium ${FRESHNESS_TONE_CLASS[freshness.tone]}`}>
              {freshness.label}
            </p>
          </div>
        );
      }}
    </DashboardSectionShell>
  );
}
