import {
  createEditorVideoAsset,
  listEditorVideoAssets,
} from "@magazine/db/editor";
import { CAPABILITY, type EditorialVideoWriteInput } from "@magazine/domain";
import { withEditorRead, withEditorWrite } from "@/lib/content/api-auth";
import { EDITOR_API_ERROR, EditorHttpError, editorOk } from "@/lib/content/http";
import { env } from "@/lib/env";
import { parseVideoLibraryQuery } from "@/lib/video/params";
import { serializeVideoLibraryItem } from "@/lib/video/serialize";

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
    const parsed = parseVideoLibraryQuery(new URL(request.url).searchParams);
    if ("error" in parsed) {
      throw new EditorHttpError(400, EDITOR_API_ERROR.INVALID_REQUEST, parsed.error);
    }

    const result = await listEditorVideoAssets({
      roles: session.roles,
      mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      q: parsed.q,
      provider: parsed.provider,
      poster: parsed.poster,
      used: parsed.used ? true : undefined,
      unused: parsed.unused ? true : undefined,
      cursor: parsed.cursor,
      pageSize: parsed.pageSize,
    });

    return editorOk({
      items: result.items.map(serializeVideoLibraryItem),
      nextCursor: result.nextCursor,
      totalCount: result.totalCount,
    });
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
      return editorOk(created, 201);
    },
  );
}
