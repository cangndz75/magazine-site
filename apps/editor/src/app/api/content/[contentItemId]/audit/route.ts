import { CAPABILITY } from "@magazine/domain";
import { listContentAuditEvents } from "@magazine/db/editor";
import { withEditorRead } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import {
  parseAuditHistorySearchParams,
  parseContentItemId,
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
    const params = parseAuditHistorySearchParams(new URL(request.url));
    const result = await listContentAuditEvents(
      id,
      editorScopeFromSession(session),
      params,
    );

    if (!result) {
      await loadAccessibleContent(session, id);
    }

    return editorOk({
      items: (result?.items ?? []).map((item) => ({
        ...item,
        occurredAt: item.occurredAt.toISOString(),
      })),
      nextCursor: result?.nextCursor ?? null,
    });
  });
}
