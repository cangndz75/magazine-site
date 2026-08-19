import { CAPABILITY } from "@magazine/domain";
import { moveHomepageFeaturedSlot } from "@magazine/db/editor";
import { withEditorWrite } from "@/lib/content/api-auth";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { loadHomepageBuilderView } from "@/lib/homepage/builder-presentation";
import { parseMoveHomepageFeaturedBody } from "@/lib/homepage/builder-payload";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.HOMEPAGE_MANAGE,
    async (session, body) => {
      const parsed = parseMoveHomepageFeaturedBody(body);
      const scope = editorScopeFromSession(session);

      await moveHomepageFeaturedSlot({
        scope,
        actorId: session.staffUserId,
        expectedUpdatedAt: parsed.expectedUpdatedAt,
        slotKey: parsed.slotKey,
        direction: parsed.direction,
      });

      const builder = await loadHomepageBuilderView(session);
      return editorOk({ builder });
    },
  );
}
