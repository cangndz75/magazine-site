import { CAPABILITY } from "@magazine/domain";
import { listContentRevisionHistory } from "@magazine/db/editor";
import { withEditorRead } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import {
  parseContentItemId,
  parseRevisionHistorySearchParams,
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
    const filters = parseRevisionHistorySearchParams(new URL(request.url));
    const result = await listContentRevisionHistory(
      id,
      editorScopeFromSession(session),
      filters,
    );
    return editorOk(result);
  });
}
