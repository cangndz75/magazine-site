import { getEntityById, updateEntity } from "@magazine/db/entities";
import { withEntityManagerRead, withEntityManagerWrite } from "@/lib/entity/route-auth";
import { entityStaffActorFromSession } from "@/lib/entity/actor";
import { parseEntityId, parseEntityUpdateBody } from "@/lib/entity/payload";
import {
  assertSafeEntityHttpPayload,
  serializeEntityDetail,
} from "@/lib/entity/serialize";
import { editorOk } from "@/lib/content/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entityId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { entityId: rawId } = await context.params;
  const entityId = parseEntityId(rawId);

  return withEntityManagerRead(_request, async (session) => {
    const entity = await getEntityById({
      actorRoles: session.roles,
      entityId,
    });
    const payload = serializeEntityDetail(entity);
    assertSafeEntityHttpPayload(payload);
    return editorOk(payload);
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { entityId: rawId } = await context.params;
  const entityId = parseEntityId(rawId);

  return withEntityManagerWrite(request, async (session, body) => {
    const parsed = parseEntityUpdateBody(body);
    const updated = await updateEntity({
      actor: entityStaffActorFromSession(session),
      entityId,
      expectedUpdatedAt: parsed.expectedUpdatedAt,
      profile: parsed.profile,
    });
    const payload = serializeEntityDetail(updated);
    assertSafeEntityHttpPayload(payload);
    return editorOk(payload);
  });
}
