import { CAPABILITY } from "@magazine/domain";
import { listReviewQueue } from "@magazine/db/editor";
import { withEditorRead } from "@/lib/content/api-auth";
import { queryScopeFromSession } from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseReviewQueueSearchParams } from "@/lib/content/list-params";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.CONTENT_REVIEW, async (session) => {
    const filters = parseReviewQueueSearchParams(new URL(request.url));
    const result = await listReviewQueue(
      queryScopeFromSession(session),
      filters,
    );
    return editorOk(result);
  });
}
