import { CAPABILITY } from "@magazine/domain";
import {
  listFeatureControls,
  listRecentFeatureControlAuditEvents,
} from "@magazine/db/feature-controls";
import { FeatureControlsWorkspace } from "@/components/feature-controls/feature-controls-workspace";
import { requireCapability } from "@/lib/auth/authorization";
import { featureControlActorFromSession } from "@/lib/feature-controls/actor";
import {
  serializeFeatureControl,
  serializeFeatureControlAuditEvent,
} from "@/lib/feature-controls/serialize";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Özellik Kontrolleri",
};

export default async function FeatureControlsPage() {
  const session = await requireCapability(CAPABILITY.STAFF_MANAGE);
  const actor = featureControlActorFromSession(session);

  let controls: ReturnType<typeof serializeFeatureControl>[] = [];
  let audit: ReturnType<typeof serializeFeatureControlAuditEvent>[] = [];
  let loadError = false;

  try {
    const [controlRows, auditRows] = await Promise.all([
      listFeatureControls(actor),
      listRecentFeatureControlAuditEvents(actor),
    ]);
    controls = controlRows.map(serializeFeatureControl);
    audit = auditRows.map(serializeFeatureControlAuditEvent);
  } catch {
    loadError = true;
  }

  return (
    <main id="editor-content" className="px-4 py-5 sm:px-6 lg:px-8">
      <FeatureControlsWorkspace
        controls={controls}
        audit={audit}
        loadError={loadError}
      />
    </main>
  );
}
