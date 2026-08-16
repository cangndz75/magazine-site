import { CAPABILITY } from "@magazine/domain";
import { submitForReview } from "@magazine/db/publishing";
import { withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { parseSubmitReviewBody } from "@/lib/content/payload";

export const dynamic = "force-dynamic";

export async function POST(
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
      const parsed = parseSubmitReviewBody(body);
      const result = await submitForReview(id, parsed.versionId, {
        expectedUpdatedAt: parsed.expectedUpdatedAt,
        scope: editorScopeFromSession(session),
        actorId: session.staffUserId,
      });
      return editorOk(result);
    },
  );
}
