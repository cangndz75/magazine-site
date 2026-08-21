import { reactivateEntity } from "@magazine/db/entities";
import { withEntityManagerWrite } from "@/lib/entity/route-auth";
import { entityStaffActorFromSession } from "@/lib/entity/actor";
import {
  parseEntityExpectedUpdatedAtBody,
  parseEntityId,
} from "@/lib/entity/payload";
import {
  assertSafeEntityHttpPayload,
  serializeEntityDetail,
} from "@/lib/entity/serialize";
import { editorOk } from "@/lib/content/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entityId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { entityId: rawId } = await context.params;
  const entityId = parseEntityId(rawId);

  return withEntityManagerWrite(request, async (session, body) => {
    const parsed = parseEntityExpectedUpdatedAtBody(body);
    const updated = await reactivateEntity({
      actor: entityStaffActorFromSession(session),
      entityId,
      expectedUpdatedAt: parsed.expectedUpdatedAt,
    });
    const payload = serializeEntityDetail(updated);
    assertSafeEntityHttpPayload(payload);
    return editorOk(payload);
  });
}
