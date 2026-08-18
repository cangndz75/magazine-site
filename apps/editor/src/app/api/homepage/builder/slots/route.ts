import { CAPABILITY } from "@magazine/domain";
import {
  clearHomepageSlot,
  setHomepageSlot,
} from "@magazine/db/editor";
import { withEditorWrite } from "@/lib/content/api-auth";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { loadHomepageBuilderView } from "@/lib/homepage/builder-presentation";
import { parseSetHomepageSlotBody } from "@/lib/homepage/builder-payload";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.HOMEPAGE_MANAGE,
    async (session, body) => {
      const parsed = parseSetHomepageSlotBody(body);
      const scope = editorScopeFromSession(session);

      if (parsed.contentItemId === null) {
        await clearHomepageSlot({
          scope,
          actorId: session.staffUserId,
          expectedUpdatedAt: parsed.expectedUpdatedAt,
          slotKey: parsed.slotKey,
        });
      } else {
        await setHomepageSlot({
          scope,
          actorId: session.staffUserId,
          expectedUpdatedAt: parsed.expectedUpdatedAt,
          slotKey: parsed.slotKey,
          contentItemId: parsed.contentItemId,
        });
      }

      const builder = await loadHomepageBuilderView(session);
      return editorOk({ builder });
    },
  );
}
