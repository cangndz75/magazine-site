import {
  getEditorVideoAsset,
  updateEditorVideoAsset,
} from "@magazine/db/editor";
import { CAPABILITY, type EditorialVideoWriteInput } from "@magazine/domain";
import { withEditorRead, withEditorWrite } from "@/lib/content/api-auth";
import { EDITOR_API_ERROR, EditorHttpError, editorOk } from "@/lib/content/http";
import { env } from "@/lib/env";
import { serializeVideoInspector } from "@/lib/video/serialize";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ videoAssetId: string }>;
};

function isVideoUpdateBody(
  value: unknown,
): value is EditorialVideoWriteInput & { expectedUpdatedAt: string } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    typeof body.providerUrlOrId === "string" &&
    typeof body.title === "string" &&
    typeof body.expectedUpdatedAt === "string"
  );
}

async function routeVideoAssetId(context: RouteContext): Promise<string> {
  const { videoAssetId } = await context.params;
  if (!videoAssetId || videoAssetId.trim().length === 0) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "Invalid video id.",
    );
  }
  return videoAssetId;
}

export async function GET(request: Request, context: RouteContext) {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async (session) => {
    const videoAssetId = await routeVideoAssetId(context);
    const video = await getEditorVideoAsset({
      videoAssetId,
      roles: session.roles,
      scopeMode: session.scopeMode,
      scopedCategoryIds: session.scopedCategoryIds,
      mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
    });
    return editorOk(serializeVideoInspector(video));
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_EDIT,
    async (session, body) => {
      if (!isVideoUpdateBody(body)) {
        throw new EditorHttpError(
          400,
          EDITOR_API_ERROR.INVALID_REQUEST,
          "Video fields are missing or invalid.",
        );
      }
      const videoAssetId = await routeVideoAssetId(context);
      await updateEditorVideoAsset({
        videoAssetId,
        roles: session.roles,
        expectedUpdatedAt: body.expectedUpdatedAt,
        video: {
          providerUrlOrId: body.providerUrlOrId,
          title: body.title,
          caption: body.caption,
          description: body.description,
          durationSeconds: body.durationSeconds,
          posterMediaId: body.posterMediaId,
          rightsNote: body.rightsNote,
          provenance: body.provenance,
        },
      });
      const video = await getEditorVideoAsset({
        videoAssetId,
        roles: session.roles,
        scopeMode: session.scopeMode,
        scopedCategoryIds: session.scopedCategoryIds,
        mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      });
      return editorOk(serializeVideoInspector(video));
    },
  );
}
