import { CAPABILITY } from "@magazine/domain";
import {
  createRedirectRule,
  listRedirectRules,
} from "@magazine/db/redirects";
import { withEditorRead, withEditorWrite } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { redirectActorFromSession } from "@/lib/redirects/actor";
import {
  parseRedirectCreateBody,
  parseRedirectListQuery,
} from "@/lib/redirects/payload";
import {
  assertSafeRedirectHttpPayload,
  serializeRedirectRule,
} from "@/lib/redirects/serialize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.CONTENT_PUBLISH, async (session) => {
    const query = parseRedirectListQuery(new URL(request.url));
    const result = await listRedirectRules({
      actor: redirectActorFromSession(session),
      search: query.search,
      enabled: query.enabled,
      cursor: query.cursor,
      limit: query.limit,
    });
    const payload = {
      items: result.items.map(serializeRedirectRule),
      nextCursor: result.nextCursor,
    };
    assertSafeRedirectHttpPayload(payload);
    return editorOk(payload);
  });
}

export async function POST(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_PUBLISH,
    async (session, body) => {
      const parsed = parseRedirectCreateBody(body);
      const created = await createRedirectRule({
        actor: redirectActorFromSession(session),
        sourcePath: parsed.sourcePath,
        targetPath: parsed.targetPath,
        note: parsed.note,
      });
      const payload = serializeRedirectRule({
        ...created,
        updatedByDisplayName: session.displayName,
      });
      assertSafeRedirectHttpPayload(payload);
      return editorOk(payload, 201);
    },
  );
}
