import { getEntityById, updateEntitySlug } from "@magazine/db/entities";
import { withEntityManagerWrite } from "@/lib/entity/route-auth";
import { entityStaffActorFromSession } from "@/lib/entity/actor";
import { parseEntityId, parseEntitySlugBody } from "@/lib/entity/payload";
import {
  assertSafeEntityHttpPayload,
  serializeEntityDetail,
} from "@/lib/entity/serialize";
import { editorOk } from "@/lib/content/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entityId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { entityId: rawId } = await context.params;
  const entityId = parseEntityId(rawId);

  return withEntityManagerWrite(request, async (session, body) => {
    const parsed = parseEntitySlugBody(body);
    const result = await updateEntitySlug({
      actor: entityStaffActorFromSession(session),
      entityId,
      expectedUpdatedAt: parsed.expectedUpdatedAt,
      slug: parsed.slug,
    });
    const entity = await getEntityById({
      actorRoles: session.roles,
      entityId: result.entityId,
    });
    const payload = {
      ...serializeEntityDetail(entity),
      slugChange: {
        previousSlug: result.previousSlug,
        unchanged: result.unchanged,
      },
    };
    assertSafeEntityHttpPayload(payload);
    return editorOk(payload);
  });
}
