import { CAPABILITY } from "@magazine/domain";
import { updateDraftScalarFields } from "@magazine/db/publishing";
import { withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { parseArticleEditorSaveBody } from "@/lib/content/payload";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ contentItemId: string }> },
) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_EDIT,
    async (session, body) => {
      const { contentItemId } = await context.params;
      const id = parseContentItemId(contentItemId);
      await loadAccessibleContent(session, id);
      const parsed = parseArticleEditorSaveBody(body);

      const result = await updateDraftScalarFields({
        contentItemId: id,
        scope: editorScopeFromSession(session),
        actorId: session.staffUserId,
        ...parsed,
      });

      return editorOk({
        ...result,
        updatedAt: result.updatedAt.toISOString(),
      });
    },
  );
}
