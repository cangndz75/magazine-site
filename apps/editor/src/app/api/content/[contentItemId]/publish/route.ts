import { CAPABILITY } from "@magazine/domain";
import { publishVersion } from "@magazine/db/publishing";
import { withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { parseVersionIdBody } from "@/lib/content/payload";
import { invalidatePublicArticleCache } from "@/lib/content/public-cache-invalidation";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ contentItemId: string }> },
) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_PUBLISH,
    async (session, body) => {
      const { contentItemId } = await context.params;
      const id = parseContentItemId(contentItemId);
      await loadAccessibleContent(session, id);
      const { versionId } = parseVersionIdBody(body);
      const result = await publishVersion(
        id,
        versionId,
        editorScopeFromSession(session),
        session.staffUserId,
      );
      await invalidatePublicArticleCache(result);
      return editorOk(result);
    },
  );
}
