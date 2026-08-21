import Link from "next/link";
import type { DashboardSection, SuperAdminUpcomingPublishingItem } from "@magazine/db/editor";
import { DashboardSectionShell } from "./dashboard-section-shell";
import { formatDashboardDay, formatDashboardTime } from "@/lib/dashboard/dashboard-presentation";

export function DashboardUpcomingPublishing({
  section,
}: {
  section: DashboardSection<{ limit: number; items: SuperAdminUpcomingPublishingItem[] }>;
}) {
  return (
    <DashboardSectionShell
      title="Yaklaşan Yayınlar"
      section={section}
      action={{ href: "/?view=SCHEDULED", label: "Tümü" }}
      emptyWhen={(data) => data.items.length === 0}
      empty={
        <p className="py-2 text-sm text-zinc-500">
          Yayın takvimi için planlanmış içerik bulunmuyor.
        </p>
      }
    >
      {(data) => (
        <ol className="divide-y divide-zinc-100">
          {data.items.map((item, index) => (
            <li key={item.contentItemId} className={index === 0 ? "pb-3" : "py-3"}>
              <Link href={item.targetHref} className="group flex items-start gap-3">
                <div
                  className={`shrink-0 rounded px-2 py-1 text-center leading-tight ${
                    index === 0 ? "bg-pink-600 text-white" : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide">
                    {formatDashboardDay(item.scheduledAt)}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatDashboardTime(item.scheduledAt)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate font-medium group-hover:underline ${
                      index === 0 ? "text-base text-zinc-950" : "text-sm text-zinc-800"
                    }`}
                  >
                    {item.title}
                  </p>
                  {item.primaryCategory && (
                    <p className="mt-0.5 text-xs text-zinc-500">{item.primaryCategory.name}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </DashboardSectionShell>
  );
}
