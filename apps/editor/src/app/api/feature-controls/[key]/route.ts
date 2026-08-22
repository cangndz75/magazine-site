import { CAPABILITY } from "@magazine/domain";
import { updateFeatureControl } from "@magazine/db/feature-controls";
import { withEditorWrite } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { featureControlActorFromSession } from "@/lib/feature-controls/actor";
import {
  parseFeatureControlKey,
  parseFeatureControlUpdateBody,
} from "@/lib/feature-controls/payload";
import {
  assertSafeFeatureControlHttpPayload,
  serializeFeatureControl,
} from "@/lib/feature-controls/serialize";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ key: string }> },
) {
  return withEditorWrite(
    request,
    CAPABILITY.STAFF_MANAGE,
    async (session, body) => {
      const { key: rawKey } = await context.params;
      const key = parseFeatureControlKey(rawKey);
      const parsed = parseFeatureControlUpdateBody(body);
      const updated = await updateFeatureControl({
        key,
        enabled: parsed.enabled,
        expectedUpdatedAt: parsed.expectedUpdatedAt,
        actor: featureControlActorFromSession(session),
      });
      const payload = serializeFeatureControl({
        ...updated,
        updatedByDisplayName: session.displayName,
      });
      assertSafeFeatureControlHttpPayload(payload);
      return editorOk(payload);
    },
  );
}
