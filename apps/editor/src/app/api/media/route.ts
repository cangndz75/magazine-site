import { listEditorMedia } from "@magazine/db/editor";
import { CAPABILITY } from "@magazine/domain";
import { withEditorRead } from "@/lib/content/api-auth";
import { EDITOR_API_ERROR, EditorHttpError, editorOk } from "@/lib/content/http";
import { env } from "@/lib/env";
import { parseMediaLibraryQuery } from "@/lib/media/params";
import { serializeMediaLibraryItem } from "@/lib/media/serialize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async (session) => {
    const parsed = parseMediaLibraryQuery(new URL(request.url).searchParams);
    if ("error" in parsed) {
      throw new EditorHttpError(400, EDITOR_API_ERROR.INVALID_REQUEST, parsed.error);
    }

    const result = await listEditorMedia({
      roles: session.roles,
      mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      q: parsed.q,
      mediaType: parsed.type,
      rightsStatus: parsed.rightsStatus,
      missingCredit: parsed.missingCredit ? true : undefined,
      missingAltText: parsed.missingAltText ? true : undefined,
      used: parsed.used ? true : undefined,
      unused: parsed.unused ? true : undefined,
      sort: parsed.sort,
      cursor: parsed.cursor,
      pageSize: String(parsed.pageSize),
    });

    return editorOk({
      items: result.items.map(serializeMediaLibraryItem),
      nextCursor: result.nextCursor,
      totalCount: result.totalCount,
      summary: result.summary,
    });
  });
}
