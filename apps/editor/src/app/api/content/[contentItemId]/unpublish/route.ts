import { CAPABILITY } from "@magazine/domain";
import { unpublishContent } from "@magazine/db/publishing";
import { withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { invalidatePublicArticleCache } from "@/lib/content/public-cache-invalidation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ contentItemId: string }> },
) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_PUBLISH,
    async (session) => {
      const { contentItemId } = await context.params;
      const id = parseContentItemId(contentItemId);
      await loadAccessibleContent(session, id);
      const result = await unpublishContent(
        id,
        editorScopeFromSession(session),
        session.staffUserId,
      );
      await invalidatePublicArticleCache(result);
      return editorOk(result);
    },
  );
}
