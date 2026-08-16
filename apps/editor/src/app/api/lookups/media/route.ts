import { CAPABILITY, MEDIA_TYPES, type MediaType } from "@magazine/domain";
import { lookupEditorMedia } from "@magazine/db/editor";
import { withEditorRead } from "@/lib/content/api-auth";
import { EDITOR_API_ERROR, EditorHttpError, editorOk } from "@/lib/content/http";
import { parseLookupSearchParams } from "@/lib/content/list-params";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async () => {
    const url = new URL(request.url);
    const params = parseLookupSearchParams(url);
    const mediaTypeRaw = url.searchParams.get("mediaType");
    let mediaType: MediaType | undefined;
    if (mediaTypeRaw) {
      if (!(MEDIA_TYPES as readonly string[]).includes(mediaTypeRaw)) {
        throw new EditorHttpError(
          400,
          EDITOR_API_ERROR.INVALID_REQUEST,
          "The request is invalid.",
        );
      }
      mediaType = mediaTypeRaw as MediaType;
    }

    const items = await lookupEditorMedia({ ...params, mediaType });
    return editorOk({ items });
  });
}
