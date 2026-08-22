import {
  createHomepageConversationItem,
  deleteHomepageConversationItem,
  updateHomepageConversationItem,
} from "@magazine/db/editor";
import { CAPABILITY } from "@magazine/domain";
import { withEditorRead, withEditorWrite } from "@/lib/content/api-auth";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { loadHomepageBuilderView } from "@/lib/homepage/builder-presentation";
import {
  parseCreateHomepageConversationBody,
  parseDeleteHomepageConversationBody,
  parseUpdateHomepageConversationBody,
} from "@/lib/homepage/builder-payload";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.HOMEPAGE_MANAGE, async (session) => {
    const builder = await loadHomepageBuilderView(session);
    return editorOk({ builder });
  });
}

export async function POST(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.HOMEPAGE_MANAGE,
    async (session, body) => {
      const parsed = parseCreateHomepageConversationBody(body);
      await createHomepageConversationItem({
        scope: editorScopeFromSession(session),
        label: parsed.label,
        reason: parsed.reason,
        contentItemId: parsed.contentItemId,
        isActive: parsed.isActive,
      });
      const builder = await loadHomepageBuilderView(session);
      return editorOk({ builder });
    },
  );
}

export async function PATCH(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.HOMEPAGE_MANAGE,
    async (session, body) => {
      const parsed = parseUpdateHomepageConversationBody(body);
      await updateHomepageConversationItem({
        scope: editorScopeFromSession(session),
        id: parsed.id,
        expectedUpdatedAt: new Date(parsed.expectedUpdatedAt),
        label: parsed.label,
        reason: parsed.reason,
        contentItemId: parsed.contentItemId,
        isActive: parsed.isActive,
      });
      const builder = await loadHomepageBuilderView(session);
      return editorOk({ builder });
    },
  );
}

export async function DELETE(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.HOMEPAGE_MANAGE,
    async (session, body) => {
      const parsed = parseDeleteHomepageConversationBody(body);
      await deleteHomepageConversationItem({
        scope: editorScopeFromSession(session),
        id: parsed.id,
        expectedUpdatedAt: new Date(parsed.expectedUpdatedAt),
      });
      const builder = await loadHomepageBuilderView(session);
      return editorOk({ builder });
    },
  );
}
