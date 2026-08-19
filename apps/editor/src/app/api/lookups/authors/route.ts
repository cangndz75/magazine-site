import { CAPABILITY } from "@magazine/domain";
import { lookupEditorAuthors } from "@magazine/db/editor";
import { withEditorRead } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { parseLookupSearchParams } from "@/lib/content/list-params";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async () => {
    const params = parseLookupSearchParams(new URL(request.url));
    const items = await lookupEditorAuthors(params);
    return editorOk({ items });
  });
}
