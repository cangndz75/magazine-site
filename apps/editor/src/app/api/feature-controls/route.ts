import { CAPABILITY } from "@magazine/domain";
import {
  listFeatureControls,
  listRecentFeatureControlAuditEvents,
} from "@magazine/db/feature-controls";
import { withEditorRead } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { featureControlActorFromSession } from "@/lib/feature-controls/actor";
import {
  assertSafeFeatureControlHttpPayload,
  serializeFeatureControl,
  serializeFeatureControlAuditEvent,
} from "@/lib/feature-controls/serialize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.STAFF_MANAGE, async (session) => {
    const actor = featureControlActorFromSession(session);
    const [controls, audit] = await Promise.all([
      listFeatureControls(actor),
      listRecentFeatureControlAuditEvents(actor),
    ]);
    const payload = {
      controls: controls.map(serializeFeatureControl),
      audit: audit.map(serializeFeatureControlAuditEvent),
    };
    assertSafeFeatureControlHttpPayload(payload);
    return editorOk(payload);
  });
}
