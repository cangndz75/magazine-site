import { Suspense } from "react";
import { CAPABILITY } from "@magazine/domain";
import { requireCapability } from "@/lib/auth/authorization";
import { LegalDashboardWorkspace } from "@/components/legal-dashboard-workspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Yasal ve düzeltmeler",
};

export default async function LegalDashboardPage() {
  await requireCapability(CAPABILITY.CONTENT_LEGAL);

  return (
    <Suspense fallback={<p className="px-4 py-6 text-sm text-zinc-500">Yükleniyor…</p>}>
      <LegalDashboardWorkspace />
    </Suspense>
  );
}
