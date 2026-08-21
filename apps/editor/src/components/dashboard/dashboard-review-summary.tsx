import Link from "next/link";
import type { DashboardSection, SuperAdminReviewSummary } from "@magazine/db/editor";
import { DashboardSectionShell } from "./dashboard-section-shell";
import { formatDashboardCount, formatDashboardRelative } from "@/lib/dashboard/dashboard-presentation";

export function DashboardReviewSummary({
  section,
}: {
  section: DashboardSection<SuperAdminReviewSummary>;
}) {
  return (
    <DashboardSectionShell
      title="İnceleme Kuyruğu"
      section={section}
      action={{ href: "/review", label: "İnceleme Kuyruğuna Git" }}
      emptyWhen={(data) => data.items.length === 0}
      empty={<p className="py-2 text-sm text-zinc-500">İncelemede içerik yok.</p>}
    >
      {(data) => (
        <div>
          <div className="mb-3 flex gap-6">
            <div>
              <p className="text-xs text-zinc-500">Bekleyen</p>
              <p className="text-lg font-semibold tabular-nums text-zinc-950">
                {formatDashboardCount(data.count)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Değişiklik İstendi</p>
              <p className="text-lg font-semibold tabular-nums text-zinc-950">
                {formatDashboardCount(data.changesRequested)}
              </p>
            </div>
          </div>
          <ul className="divide-y divide-zinc-100">
            {data.items.map((item) => (
              <li key={item.versionId} className="py-2">
                <Link href={item.targetHref} className="group flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-zinc-800 group-hover:text-zinc-950 group-hover:underline">
                    {item.title}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    Tur {item.reviewRound} · {formatDashboardRelative(item.latestSubmittedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardSectionShell>
  );
}
