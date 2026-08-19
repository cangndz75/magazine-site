import { getEditorMediaInspector, updateMediaRights } from "@magazine/db/editor";
import {
  CAPABILITY,
  type MediaRightsWriteInput,
} from "@magazine/domain";
import { withEditorWrite } from "@/lib/content/api-auth";
import { EDITOR_API_ERROR, EditorHttpError, editorOk } from "@/lib/content/http";
import { env } from "@/lib/env";
import { serializeMediaInspector } from "@/lib/media/serialize";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ mediaId: string }>;
};

function isRightsBody(value: unknown): value is MediaRightsWriteInput {
  if (!value || typeof value !== "object") {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    typeof body.sourceKind === "string" &&
    typeof body.licenseType === "string" &&
    typeof body.usageRestriction === "string"
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_EDIT,
    async (session, body) => {
      const { mediaId } = await context.params;
      if (!mediaId || mediaId.trim().length === 0) {
        throw new EditorHttpError(
          400,
          EDITOR_API_ERROR.INVALID_REQUEST,
          "Geçersiz medya kimliği.",
        );
      }

      if (!isRightsBody(body)) {
        throw new EditorHttpError(
          400,
          EDITOR_API_ERROR.INVALID_REQUEST,
          "Hak alanları eksik veya geçersiz.",
        );
      }

      await updateMediaRights({
        mediaId,
        roles: session.roles,
        rights: body,
      });

      const inspector = await getEditorMediaInspector({
        mediaId,
        roles: session.roles,
        scopeMode: session.scopeMode,
        scopedCategoryIds: session.scopedCategoryIds,
        mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      });

      return editorOk(serializeMediaInspector(inspector));
    },
  );
}
