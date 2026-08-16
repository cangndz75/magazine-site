import { CAPABILITY } from "@magazine/domain";
import { scheduleVersion } from "@magazine/db/publishing";
import { withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { parseScheduleBody } from "@/lib/content/payload";

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
      const parsed = parseScheduleBody(body);
      const result = await scheduleVersion(
        id,
        parsed.versionId,
        parsed.scheduledAt,
        editorScopeFromSession(session),
      );
      return editorOk(result);
    },
  );
}
