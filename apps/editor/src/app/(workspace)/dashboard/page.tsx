import { CAPABILITY } from "@magazine/domain";
import { getSuperAdminDashboard } from "@magazine/db/editor";
import { requireCapability } from "@/lib/auth/authorization";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { DashboardControlCenter } from "@/components/dashboard/dashboard-control-center";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kontrol Merkezi",
};

export default async function DashboardPage() {
  const session = await requireCapability(CAPABILITY.STAFF_MANAGE);
  const dashboard = await getSuperAdminDashboard({
    scope: editorScopeFromSession(session),
  });

  return <DashboardControlCenter dashboard={dashboard} />;
}
