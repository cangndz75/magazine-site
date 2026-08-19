import { setDraftVersionVideos } from "@magazine/db/publishing";
import { CAPABILITY } from "@magazine/domain";
import { withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { EDITOR_API_ERROR, EditorHttpError, editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { env } from "@/lib/env";
import { serializeDraftVideos } from "@/lib/video/serialize";

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
      const id = parseContentItemId(contentItemId);
      await loadAccessibleContent(session, id);
      if (!isVideoRelationBody(body)) {
        throw new EditorHttpError(
          400,
          EDITOR_API_ERROR.INVALID_REQUEST,
          "Video relation payload is invalid.",
        );
      }

      const result = await setDraftVersionVideos({
        contentItemId: id,
        versionId: body.versionId,
        expectedUpdatedAt: body.expectedUpdatedAt,
        items: body.items,
        scope: editorScopeFromSession(session),
        actorId: session.staffUserId,
        mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      });

      return editorOk({
        contentItemId: result.contentItemId,
        versionId: result.versionId,
        updatedAt: result.updatedAt.toISOString(),
        videos: serializeDraftVideos(result.videos),
      });
    },
  );
}
