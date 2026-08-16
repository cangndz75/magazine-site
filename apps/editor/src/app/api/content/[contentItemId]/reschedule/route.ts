import { CAPABILITY } from "@magazine/domain";
import { rescheduleVersion } from "@magazine/db/publishing";
import { withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { parseRescheduleBody } from "@/lib/content/payload";

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
      const parsed = parseRescheduleBody(body);
      const result = await rescheduleVersion(
        id,
        parsed.scheduledAt,
        editorScopeFromSession(session),
      );
      return editorOk(result);
    },
  );
}
