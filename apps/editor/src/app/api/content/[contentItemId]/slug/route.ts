import { CAPABILITY } from "@magazine/domain";
import { updateContentSlug } from "@magazine/db/publishing";
import { withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { parseContentSlugBody } from "@/lib/content/payload";

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
      const parsed = parseContentSlugBody(body);

      const result = await updateContentSlug({
        contentItemId: id,
        nextSlug: parsed.slug,
        expectedUpdatedAt: parsed.expectedUpdatedAt,
        scope: editorScopeFromSession(session),
        actorId: session.staffUserId,
      });

      return editorOk({
        contentItemId: result.contentItemId,
        previousSlug: result.previousSlug,
        slug: result.slug,
        updatedAt: result.updatedAt.toISOString(),
        unchanged: result.unchanged,
      });
    },
  );
}
