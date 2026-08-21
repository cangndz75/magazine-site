import { CAPABILITY } from "@magazine/domain";
import { getSuperAdminDashboard, type SuperAdminDashboardDto } from "@magazine/db/editor";
import { requireCapability } from "@/lib/auth/authorization";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardExecStrip } from "@/components/dashboard/dashboard-exec-strip";
import { DashboardEditorialOperations } from "@/components/dashboard/dashboard-editorial-operations";
import { DashboardUpcomingPublishing } from "@/components/dashboard/dashboard-upcoming-publishing";
import { DashboardAnalyticsSnapshot } from "@/components/dashboard/dashboard-analytics-snapshot";
import { DashboardReviewSummary } from "@/components/dashboard/dashboard-review-summary";
import { DashboardAttention } from "@/components/dashboard/dashboard-attention";
import { DashboardLegal } from "@/components/dashboard/dashboard-legal";
import { DashboardStaffSecurity } from "@/components/dashboard/dashboard-staff-security";
import { DashboardHomepageStatus } from "@/components/dashboard/dashboard-homepage-status";
import {
  DashboardSeoSummaryCard,
  DashboardSystemSignalsCard,
} from "@/components/dashboard/dashboard-system-signals";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kontrol Merkezi",
};

/** Primary/operational column: what the newsroom is producing. */
function MainColumn({ dashboard }: { dashboard: SuperAdminDashboardDto }) {
  return (
    <div className="flex flex-col gap-4">
      <DashboardEditorialOperations section={dashboard.editorial} />
      <DashboardUpcomingPublishing section={dashboard.upcomingPublishing} />
      <DashboardAnalyticsSnapshot section={dashboard.analytics} />
      <DashboardReviewSummary section={dashboard.review} />
    </div>
  );
}

/** Right rail: what needs the Super Admin's intervention. */
function RailColumn({ dashboard }: { dashboard: SuperAdminDashboardDto }) {
  return (
    <div className="flex flex-col gap-4">
      <DashboardAttention section={dashboard.attention} />
      <DashboardLegal section={dashboard.legal} />
      <DashboardStaffSecurity section={dashboard.staffSecurity} />
      <DashboardHomepageStatus section={dashboard.homepage} />
      <DashboardSeoSummaryCard section={dashboard.seo} />
      <DashboardSystemSignalsCard section={dashboard.systemSignals} />
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireCapability(CAPABILITY.STAFF_MANAGE);
  const dashboard = await getSuperAdminDashboard({
    scope: editorScopeFromSession(session),
  });

  return (
    <div className="mx-auto max-w-[100rem] px-4 py-5 sm:px-6 lg:px-8">
      <DashboardHeader generatedAt={dashboard.generatedAt} />
      <DashboardExecStrip dashboard={dashboard} />

      {/* Desktop: two independently-heighted columns (flex, not grid, so a
          short left card never stretches to match a tall right card). */}
      <div className="hidden lg:flex lg:items-start lg:gap-5">
        <div className="min-w-0 flex-1">
          <MainColumn dashboard={dashboard} />
        </div>
        <div className="w-[380px] shrink-0">
          <RailColumn dashboard={dashboard} />
        </div>
      </div>

      {/* Mobile/tablet: single column in the required attention-first priority order. */}
      <div className="flex flex-col gap-4 lg:hidden">
        <DashboardAttention section={dashboard.attention} />
        <DashboardUpcomingPublishing section={dashboard.upcomingPublishing} />
        <DashboardEditorialOperations section={dashboard.editorial} />
        <DashboardAnalyticsSnapshot section={dashboard.analytics} />
        <DashboardReviewSummary section={dashboard.review} />
        <DashboardLegal section={dashboard.legal} />
        <DashboardStaffSecurity section={dashboard.staffSecurity} />
        <DashboardHomepageStatus section={dashboard.homepage} />
        <DashboardSeoSummaryCard section={dashboard.seo} />
        <DashboardSystemSignalsCard section={dashboard.systemSignals} />
      </div>
    </div>
  );
}
