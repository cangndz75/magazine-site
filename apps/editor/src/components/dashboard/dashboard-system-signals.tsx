import type { DashboardSection, SuperAdminSeoSummary, SuperAdminSystemSignals } from "@magazine/db/editor";
import { DashboardSectionShell } from "./dashboard-section-shell";
import { formatDashboardCount } from "@/lib/dashboard/dashboard-presentation";
import { presentAnalyticsFreshness } from "@/lib/analytics/presentation";
import type { AnalyticsFreshnessDto } from "@/lib/analytics/types";

const FRESHNESS_TONE_CLASS: Record<string, string> = {
  ok: "text-emerald-700",
  pending: "text-amber-700",
  failed: "text-rose-700",
};

export function DashboardSeoSummaryCard({
  section,
}: {
  section: DashboardSection<SuperAdminSeoSummary>;
}) {
  return (
    <DashboardSectionShell title="SEO" section={section} action={{ href: "/seo", label: "SEO" }}>
      {(data) => (
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs text-zinc-500">Sağlıklı</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-950">
              {formatDashboardCount(data.healthyPublishedCount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Hata</dt>
            <dd
              className={`mt-0.5 text-base font-semibold tabular-nums ${
                data.errorCount > 0 ? "text-rose-700" : "text-zinc-950"
              }`}
            >
              {formatDashboardCount(data.errorCount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Uyarı</dt>
            <dd
              className={`mt-0.5 text-base font-semibold tabular-nums ${
                data.warningCount > 0 ? "text-amber-700" : "text-zinc-950"
              }`}
            >
              {formatDashboardCount(data.warningCount)}
            </dd>
          </div>
        </dl>
      )}
    </DashboardSectionShell>
  );
}

export function DashboardSystemSignalsCard({
  section,
}: {
  section: DashboardSection<SuperAdminSystemSignals>;
}) {
  return (
    <DashboardSectionShell title="Sistem Sinyalleri" section={section}>
      {(data) => {
        const freshness = presentAnalyticsFreshness(
          data.analyticsFreshness as AnalyticsFreshnessDto,
        );
        const outbox = data.publicCacheOutbox;
        return (
          <div>
            <dl className="grid grid-cols-3 gap-3">
              <div>
                <dt className="text-xs text-zinc-500">Bekleyen</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-950">
                  {formatDashboardCount(outbox.pending)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">İşleniyor</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-950">
                  {formatDashboardCount(outbox.processing)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Başarısız</dt>
                <dd
                  className={`mt-0.5 text-base font-semibold tabular-nums ${
                    outbox.failed > 0 ? "text-rose-700" : "text-zinc-950"
                  }`}
                >
                  {formatDashboardCount(outbox.failed)}
                </dd>
              </div>
            </dl>
            <p className={`mt-2 text-xs font-medium ${FRESHNESS_TONE_CLASS[freshness.tone]}`}>
              Analytics: {freshness.label}
            </p>
          </div>
        );
      }}
    </DashboardSectionShell>
  );
}
