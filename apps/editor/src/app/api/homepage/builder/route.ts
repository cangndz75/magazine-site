import { CAPABILITY } from "@magazine/domain";
import { withEditorRead } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { loadHomepageBuilderView } from "@/lib/homepage/builder-presentation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.HOMEPAGE_MANAGE, async (session) => {
    const builder = await loadHomepageBuilderView(session);
    return editorOk({ builder });
  });
}
