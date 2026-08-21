import type { DashboardSection, SuperAdminHomepageStatus } from "@magazine/db/editor";
import { DashboardSectionShell } from "./dashboard-section-shell";
import { formatDashboardCount, formatDashboardDateTime } from "@/lib/dashboard/dashboard-presentation";
import { StatusBadge } from "@/components/status-badge";

export function DashboardHomepageStatus({
  section,
}: {
  section: DashboardSection<SuperAdminHomepageStatus>;
}) {
  return (
    <DashboardSectionShell title="Ana Sayfa" section={section} action={{ href: "/homepage", label: "Ana Sayfa" }}>
      {(data) => (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500">Son yayın</p>
            <p className="text-sm font-medium text-zinc-950">
              {formatDashboardDateTime(data.lastPublishedAt)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {formatDashboardCount(data.publishedSlotCount)} canlı slot
            </p>
          </div>
          {data.unpublishedDraftExists && (
            <StatusBadge label="Yayınlanmamış taslak var" variant="warning" />
          )}
        </div>
      )}
    </DashboardSectionShell>
  );
}
