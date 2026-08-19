import { CAPABILITY } from "@magazine/domain";
import { approveVersion } from "@magazine/db/publishing";
import { withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { parseApproveReviewBody } from "@/lib/content/payload";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ contentItemId: string }> },
) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_REVIEW,
    async (session, body) => {
      const { contentItemId } = await context.params;
      const id = parseContentItemId(contentItemId);
      await loadAccessibleContent(session, id);
      const parsed = parseApproveReviewBody(body);
      const result = await approveVersion(id, parsed.versionId, {
        expectedUpdatedAt: parsed.expectedUpdatedAt,
        scope: editorScopeFromSession(session),
        actorId: session.staffUserId,
        note: parsed.note,
      });
      return editorOk(result);
    },
  );
}
