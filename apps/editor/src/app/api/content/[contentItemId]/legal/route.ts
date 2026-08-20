import { CAPABILITY } from "@magazine/domain";
import { getContentLegalWorkspace } from "@magazine/db/editor";
import { recordContentLegalAction } from "@magazine/db/publishing";
import { withEditorRead, withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { parseRecordLegalActionBody } from "@/lib/legal/payload";

export const dynamic = "force-dynamic";

function serializeWorkspace(workspace: NonNullable<Awaited<ReturnType<typeof getContentLegalWorkspace>>>) {
  return {
    contentItem: {
      ...workspace.contentItem,
      legalHoldAt: workspace.contentItem.legalHoldAt?.toISOString() ?? null,
      retractedAt: workspace.contentItem.retractedAt?.toISOString() ?? null,
      takedownAt: workspace.contentItem.takedownAt?.toISOString() ?? null,
      updatedAt: workspace.contentItem.updatedAt.toISOString(),
    },
    actions: workspace.actions.map((action) => ({
      ...action,
      effectiveAt: action.effectiveAt.toISOString(),
      createdAt: action.createdAt.toISOString(),
    })),
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ contentItemId: string }> },
) {
  return withEditorRead(_request, CAPABILITY.CONTENT_LEGAL, async (session) => {
    const { contentItemId } = await context.params;
    const id = parseContentItemId(contentItemId);
    await loadAccessibleContent(session, id);
    const workspace = await getContentLegalWorkspace(id);
    if (!workspace) {
      return editorOk(null, 404);
    }
    return editorOk(serializeWorkspace(workspace));
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ contentItemId: string }> },
) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_LEGAL,
    async (session, body) => {
      const { contentItemId } = await context.params;
      const id = parseContentItemId(contentItemId);
      await loadAccessibleContent(session, id);
      const parsed = parseRecordLegalActionBody(body);
      const scope = editorScopeFromSession(session);
      const result = await recordContentLegalAction({
        contentItemId: id,
        actionType: parsed.actionType,
        polarity: parsed.polarity,
        reasonCategory: parsed.reasonCategory,
        internalNote: parsed.internalNote,
        publicNote: parsed.publicNote,
        effectiveAt: parsed.effectiveAt,
        expectedUpdatedAt: parsed.expectedUpdatedAt,
        scope,
        actorId: session.staffUserId,
      });

      const workspace = await getContentLegalWorkspace(id);
      return editorOk({
        result: {
          ...result,
          publishedAt: result.publishedAt?.toISOString() ?? null,
          legalHoldAt: result.legalHoldAt?.toISOString() ?? null,
          retractedAt: result.retractedAt?.toISOString() ?? null,
          takedownAt: result.takedownAt?.toISOString() ?? null,
          updatedAt: result.updatedAt.toISOString(),
          action: {
            ...result.action,
            createdAt: result.action.createdAt.toISOString(),
            effectiveAt: result.action.effectiveAt.toISOString(),
          },
        },
        workspace: workspace ? serializeWorkspace(workspace) : null,
      });
    },
  );
}
