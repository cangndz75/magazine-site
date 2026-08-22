import { reorderHomepageConversationItems } from "@magazine/db/editor";
import { CAPABILITY } from "@magazine/domain";
import { withEditorWrite } from "@/lib/content/api-auth";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { loadHomepageBuilderView } from "@/lib/homepage/builder-presentation";
import { parseReorderHomepageConversationBody } from "@/lib/homepage/builder-payload";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.HOMEPAGE_MANAGE,
    async (session, body) => {
      const parsed = parseReorderHomepageConversationBody(body);
      await reorderHomepageConversationItems({
        scope: editorScopeFromSession(session),
        expectedUpdatedAt: parsed.expectedUpdatedAt,
        orderedIds: parsed.orderedIds,
      });
      const builder = await loadHomepageBuilderView(session);
      return editorOk({ builder });
    },
  );
}
