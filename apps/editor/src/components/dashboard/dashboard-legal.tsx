import Link from "next/link";
import type { DashboardSection, SuperAdminLegalSummary } from "@magazine/db/editor";
import { DashboardSectionShell } from "./dashboard-section-shell";
import {
  formatDashboardCount,
  formatDashboardRelative,
  legalActionLabel,
} from "@/lib/dashboard/dashboard-presentation";
import { StatusBadge } from "@/components/status-badge";

export function DashboardLegal({
  section,
}: {
  section: DashboardSection<SuperAdminLegalSummary>;
}) {
  return (
    <DashboardSectionShell title="Yasal Durum" section={section} action={{ href: "/legal", label: "Yasal" }}>
      {(data) => {
        const activeCount = data.activeHolds + data.activeTakedowns + data.activeRetractions;
        return (
          <div>
            <dl className="mb-3 grid grid-cols-3 gap-3">
              <div>
                <dt className="text-xs text-zinc-500">Hukuki Bekletme</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-950">
                  {formatDashboardCount(data.activeHolds)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Kaldırma</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-950">
                  {formatDashboardCount(data.activeTakedowns)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Geri Çekme</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-950">
                  {formatDashboardCount(data.activeRetractions)}
                </dd>
              </div>
            </dl>
            {activeCount === 0 && data.recentActions.length === 0 ? (
              <p className="text-sm text-zinc-500">Açık yasal işlem bulunmuyor.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {data.recentActions.slice(0, 4).map((item) => (
                  <li key={item.actionId} className="py-2">
                    <Link href={item.targetHref} className="group flex items-center gap-2">
                      <StatusBadge label={legalActionLabel(item.actionType)} variant="neutral" />
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-800 group-hover:text-zinc-950 group-hover:underline">
                        {item.articleTitle}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-400">
                        {formatDashboardRelative(item.effectiveAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }}
    </DashboardSectionShell>
  );
}
