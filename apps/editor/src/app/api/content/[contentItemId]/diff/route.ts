import { CAPABILITY } from "@magazine/domain";
import { getContentVersionDiff } from "@magazine/db/editor";
import { withEditorRead } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import {
  parseContentItemId,
  parseDiffSearchParams,
} from "@/lib/content/list-params";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ contentItemId: string }> },
) {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async (session) => {
    const { contentItemId } = await context.params;
    const id = parseContentItemId(contentItemId);
    await loadAccessibleContent(session, id);
    const { fromVersionId, toVersionId } = parseDiffSearchParams(
      new URL(request.url),
    );
    const result = await getContentVersionDiff(
      id,
      fromVersionId,
      toVersionId,
      editorScopeFromSession(session),
    );
    return editorOk(result);
  });
}
