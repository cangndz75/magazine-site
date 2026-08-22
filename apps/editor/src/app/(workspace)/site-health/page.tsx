import { CAPABILITY } from "@magazine/domain";
import { getSiteHealth } from "@magazine/db/editor";
import { requireCapability } from "@/lib/auth/authorization";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { SiteHealthWorkspace } from "@/components/site-health/site-health-workspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sistem Sağlığı",
};

export default async function SiteHealthPage() {
  const session = await requireCapability(CAPABILITY.STAFF_MANAGE);
  const health = await getSiteHealth({
    scope: editorScopeFromSession(session),
  });

  return (
    <main id="editor-content" className="px-4 py-5 sm:px-6 lg:px-8">
      <SiteHealthWorkspace health={health} />
    </main>
  );
}
