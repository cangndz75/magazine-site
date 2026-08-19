import { setDraftVersionVideos } from "@magazine/db/publishing";
import { CAPABILITY } from "@magazine/domain";
import { withEditorWrite } from "@/lib/content/api-auth";
import { EDITOR_API_ERROR, EditorHttpError, editorOk } from "@/lib/content/http";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ contentItemId: string }>;
};

function isVideoRelationBody(value: unknown): value is {
  versionId: string;
  expectedUpdatedAt: string;
  items: { videoAssetId: string; caption?: string | null }[];
} {
  if (!value || typeof value !== "object") {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    typeof body.versionId === "string" &&
    typeof body.expectedUpdatedAt === "string" &&
    Array.isArray(body.items) &&
    body.items.every((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const record = item as Record<string, unknown>;
      return (
        typeof record.videoAssetId === "string" &&
        (record.caption === undefined ||
          record.caption === null ||
          typeof record.caption === "string")
      );
    })
  );
}

export async function PUT(request: Request, context: RouteContext) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_EDIT,
    async (session, body) => {
      const { contentItemId } = await context.params;
      if (!contentItemId || contentItemId.trim().length === 0) {
        throw new EditorHttpError(
          400,
          EDITOR_API_ERROR.INVALID_REQUEST,
          "Invalid content item id.",
        );
      }
      if (!isVideoRelationBody(body)) {
        throw new EditorHttpError(
          400,
          EDITOR_API_ERROR.INVALID_REQUEST,
          "Video relation payload is invalid.",
        );
      }

      const result = await setDraftVersionVideos({
        contentItemId,
        versionId: body.versionId,
        expectedUpdatedAt: body.expectedUpdatedAt,
        items: body.items,
        scope: {
          roles: session.roles,
          scopeMode: session.scopeMode,
          scopedCategoryIds: session.scopedCategoryIds,
        },
        actorId: session.staffUserId,
      });

      return editorOk(result);
    },
  );
}
