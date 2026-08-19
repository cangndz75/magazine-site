import { CAPABILITY } from "@magazine/domain";
import { setDraftVersionGallery } from "@magazine/db/publishing";
import { withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { parseDraftGalleryBody } from "@/lib/content/payload";
import { serializeDraftGallery } from "@/lib/content/gallery-serialize";
import { env } from "@/lib/env";

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
      const parsed = parseDraftGalleryBody(body);
      const result = await setDraftVersionGallery({
        contentItemId: id,
        versionId: parsed.versionId,
        expectedUpdatedAt: parsed.expectedUpdatedAt,
        items: parsed.items,
        scope: editorScopeFromSession(session),
        actorId: session.staffUserId,
        mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      });

      return editorOk({
        contentItemId: result.contentItemId,
        versionId: result.versionId,
        updatedAt: result.updatedAt.toISOString(),
        gallery: serializeDraftGallery(result.gallery),
      });
    },
  );
}
