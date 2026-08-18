import { CAPABILITY } from "@magazine/domain";
import { updateDraftContent } from "@magazine/db/publishing";
import { withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { parseArticleEditorSaveBody } from "@/lib/content/payload";

export const dynamic = "force-dynamic";

export async function PATCH(
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
      const parsed = parseArticleEditorSaveBody(body);

      const result = await updateDraftContent({
        contentItemId: id,
        scope: editorScopeFromSession(session),
        actorId: session.staffUserId,
        ...parsed,
      });

      return editorOk({
        contentItemId: result.contentItemId,
        versionId: result.versionId,
        updatedAt: result.updatedAt.toISOString(),
        fields: {
          title: parsed.title,
          subtitle: parsed.subtitle,
          excerpt: parsed.excerpt,
          seoTitle: parsed.seoTitle,
          seoDescription: parsed.seoDescription,
          canonicalUrl: parsed.canonicalUrl,
          robots: parsed.robots,
          credibility: parsed.credibility,
          credibilitySource: parsed.credibilitySource,
          source: parsed.source,
          sourceOrganization: parsed.sourceOrganization,
          sourceUrl: parsed.sourceUrl,
          syndicated: parsed.syndicated,
          isMaterialUpdate: parsed.isMaterialUpdate,
        },
        relations: {
          categories: parsed.categories,
          tags: parsed.tags,
          entities: parsed.entities,
          media: parsed.media,
          authors: parsed.authors,
        },
      });
    },
  );
}
