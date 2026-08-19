import { CAPABILITY } from "@magazine/domain";
import {
  removeDraftVersionHero,
  setDraftVersionHero,
} from "@magazine/db/publishing";
import { withEditorWrite } from "@/lib/content/api-auth";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseContentItemId } from "@/lib/content/list-params";
import { parseDraftHeroBody } from "@/lib/content/payload";
import { serializeDraftHero } from "@/lib/content/hero-serialize";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ contentItemId: string }> },
) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_EDIT,
    async (session, body) => {
      const { contentItemId } = await context.params;
      const id = parseContentItemId(contentItemId);
      await loadAccessibleContent(session, id);
      const parsed = parseDraftHeroBody(body);
      const scope = editorScopeFromSession(session);

      const result =
        parsed.mediaId === null
          ? await removeDraftVersionHero({
              contentItemId: id,
              versionId: parsed.versionId,
              expectedUpdatedAt: parsed.expectedUpdatedAt,
              scope,
              actorId: session.staffUserId,
            })
          : await setDraftVersionHero({
              contentItemId: id,
              versionId: parsed.versionId,
              expectedUpdatedAt: parsed.expectedUpdatedAt,
              mediaId: parsed.mediaId,
              altText: parsed.altText,
              credit: parsed.credit,
              scope,
              actorId: session.staffUserId,
              mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
            });

      return editorOk({
        contentItemId: result.contentItemId,
        versionId: result.versionId,
        updatedAt: result.updatedAt.toISOString(),
        hero: serializeDraftHero(result.hero),
      });
    },
  );
}
