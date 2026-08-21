import { CAPABILITY } from "@magazine/domain";
import { suggestEntityLinksForArticle } from "@magazine/db/entities";
import { withEditorWrite } from "@/lib/content/api-auth";
import { loadAccessibleContent } from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { parseEntityLinkSuggestionRequest } from "@/lib/entity/link-suggestions";

export const dynamic = "force-dynamic";

export async function POST(
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
      const parsed = parseEntityLinkSuggestionRequest(body);
      const result = await suggestEntityLinksForArticle({
        body: parsed.body,
        title: parsed.title,
        relatedEntityIds: parsed.relatedEntityIds,
      });
      return editorOk(result);
    },
  );
}
