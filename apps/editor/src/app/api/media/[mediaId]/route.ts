import { getEditorMediaInspector } from "@magazine/db/editor";
import { CAPABILITY } from "@magazine/domain";
import { withEditorRead } from "@/lib/content/api-auth";
import { EDITOR_API_ERROR, EditorHttpError, editorOk } from "@/lib/content/http";
import { env } from "@/lib/env";
import { serializeMediaInspector } from "@/lib/media/serialize";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ mediaId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async (session) => {
    const { mediaId } = await context.params;
    if (!mediaId || mediaId.trim().length === 0) {
      throw new EditorHttpError(
        400,
        EDITOR_API_ERROR.INVALID_REQUEST,
        "Geçersiz medya kimliği.",
      );
    }

    const inspector = await getEditorMediaInspector({
      mediaId,
      roles: session.roles,
      scopeMode: session.scopeMode,
      scopedCategoryIds: session.scopedCategoryIds,
      mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
    });
    return editorOk(serializeMediaInspector(inspector));
  });
}
