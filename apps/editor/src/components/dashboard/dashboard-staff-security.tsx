import type { DashboardSection, SuperAdminStaffSecuritySummary } from "@magazine/db/editor";
import { DashboardSectionShell } from "./dashboard-section-shell";
import { formatDashboardCount } from "@/lib/dashboard/dashboard-presentation";

export function DashboardStaffSecurity({
  section,
}: {
  section: DashboardSection<SuperAdminStaffSecuritySummary>;
}) {
  return (
    <DashboardSectionShell
      title="Personel ve Erişim"
      section={section}
      action={{ href: "/staff", label: "Personel ve Erişim" }}
    >
      {(data) => (
        <dl className="grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs text-zinc-500">Aktif</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-950">
              {formatDashboardCount(data.active)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Devre Dışı</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-950">
              {formatDashboardCount(data.disabled)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Süper Admin</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-950">
              {formatDashboardCount(data.superAdmin)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">MFA Etkin</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-emerald-700">
              {formatDashboardCount(data.mfaConfigured)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">MFA Kurulmamış</dt>
            <dd
              className={`mt-0.5 text-base font-semibold tabular-nums ${
                data.mfaNotConfigured > 0 ? "text-amber-700" : "text-zinc-950"
              }`}
            >
              {formatDashboardCount(data.mfaNotConfigured)}
            </dd>
          </div>
        </dl>
      )}
    </DashboardSectionShell>
  );
}
