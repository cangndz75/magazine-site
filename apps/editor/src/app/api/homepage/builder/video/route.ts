import { CAPABILITY } from "@magazine/domain";
import {
  clearHomepageVideo,
  setHomepageVideo,
} from "@magazine/db/editor";
import { withEditorWrite } from "@/lib/content/api-auth";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { loadHomepageBuilderView } from "@/lib/homepage/builder-presentation";
import { parseSetHomepageVideoBody } from "@/lib/homepage/builder-payload";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.HOMEPAGE_MANAGE,
    async (session, body) => {
      const parsed = parseSetHomepageVideoBody(body);
      const scope = editorScopeFromSession(session);

      if (parsed.videoAssetId === null) {
        await clearHomepageVideo({
          scope,
          actorId: session.staffUserId,
          expectedUpdatedAt: parsed.expectedUpdatedAt,
        });
      } else {
        await setHomepageVideo({
          scope,
          actorId: session.staffUserId,
          expectedUpdatedAt: parsed.expectedUpdatedAt,
          videoAssetId: parsed.videoAssetId,
        });
      }

      const builder = await loadHomepageBuilderView(session);
      return editorOk({ builder });
    },
  );
}
