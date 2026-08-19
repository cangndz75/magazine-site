import { CAPABILITY } from "@magazine/domain";
import { createContent } from "@magazine/db/publishing";
import { listEditorContent } from "@magazine/db/editor";
import { withEditorRead, withEditorWrite } from "@/lib/content/api-auth";
import { editorScopeFromSession, queryScopeFromSession } from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseEditorListSearchParams } from "@/lib/content/list-params";
import { parseCreateContentBody } from "@/lib/content/payload";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async (session) => {
    const filters = parseEditorListSearchParams(new URL(request.url));
    const result = await listEditorContent(queryScopeFromSession(session), filters, {
      mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
    });
    return editorOk(result);
  });
}

export async function POST(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_CREATE,
    async (session, body) => {
      const parsed = parseCreateContentBody(body, editorScopeFromSession(session));
      const created = await createContent({
        slug: parsed.slug,
        title: parsed.title,
        body: parsed.body,
        subtitle: parsed.subtitle,
        excerpt: parsed.excerpt,
        categories: parsed.primaryCategoryId
          ? [{ categoryId: parsed.primaryCategoryId, isPrimary: true }]
          : [],
        scope: editorScopeFromSession(session),
        actorId: session.staffUserId,
      });
      return editorOk(created, 201);
    },
  );
}
