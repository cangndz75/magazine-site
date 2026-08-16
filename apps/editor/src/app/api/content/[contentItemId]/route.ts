import { CAPABILITY, PUBLISHING_ERROR, PublishingError } from "@magazine/domain";
import { getEditorContentDetail } from "@magazine/db/editor";
import { withEditorRead } from "@/lib/content/api-auth";
import { loadAccessibleContent } from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ contentItemId: string }> },
) {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async (session) => {
    const { contentItemId } = await context.params;
    const id = parseContentItemId(contentItemId);
    await loadAccessibleContent(session, id);
    const detail = await getEditorContentDetail(id);
    if (!detail) {
      throw new PublishingError(PUBLISHING_ERROR.CONTENT_NOT_FOUND);
    }

    return editorOk(detail);
  });
}
