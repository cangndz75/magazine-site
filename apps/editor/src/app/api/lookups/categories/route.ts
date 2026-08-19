import { CAPABILITY } from "@magazine/domain";
import { lookupEditorCategories } from "@magazine/db/editor";
import { withEditorRead } from "@/lib/content/api-auth";
import { queryScopeFromSession } from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseLookupSearchParams } from "@/lib/content/list-params";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async (session) => {
    const params = parseLookupSearchParams(new URL(request.url));
    const items = await lookupEditorCategories({
      ...params,
      scopedCategoryIds: queryScopeFromSession(session).scopedCategoryIds,
    });
    return editorOk({ items });
  });
}
