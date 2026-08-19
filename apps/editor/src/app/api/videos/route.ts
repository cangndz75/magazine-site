import {
  createEditorVideoAsset,
  listEditorVideoAssets,
} from "@magazine/db/editor";
import { CAPABILITY, type EditorialVideoWriteInput } from "@magazine/domain";
import { withEditorRead, withEditorWrite } from "@/lib/content/api-auth";
import { EDITOR_API_ERROR, EditorHttpError, editorOk } from "@/lib/content/http";

export const dynamic = "force-dynamic";

function isVideoWriteBody(value: unknown): value is EditorialVideoWriteInput {
  if (!value || typeof value !== "object") {
    return false;
  }
  const body = value as Record<string, unknown>;
  return (
    typeof body.providerUrlOrId === "string" &&
    typeof body.title === "string"
  );
}

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async (session) => {
    const result = await listEditorVideoAssets({ roles: session.roles });
    return editorOk(result);
  });
}

export async function POST(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_EDIT,
    async (session, body) => {
      if (!isVideoWriteBody(body)) {
        throw new EditorHttpError(
          400,
          EDITOR_API_ERROR.INVALID_REQUEST,
          "Video fields are missing or invalid.",
        );
      }
      const created = await createEditorVideoAsset({
        roles: session.roles,
        video: body,
      });
      return editorOk(created, 201);
    },
  );
}
