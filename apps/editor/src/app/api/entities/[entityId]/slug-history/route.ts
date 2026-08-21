import { listEntitySlugHistory } from "@magazine/db/entities";
import { withEntityManagerRead } from "@/lib/entity/route-auth";
import { parseEntityId } from "@/lib/entity/payload";
import {
  assertSafeEntityHttpPayload,
  serializeEntitySlugHistoryItem,
} from "@/lib/entity/serialize";
import { editorOk } from "@/lib/content/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ entityId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { entityId: rawId } = await context.params;
  const entityId = parseEntityId(rawId);

  return withEntityManagerRead(_request, async (session) => {
    const items = await listEntitySlugHistory({
      actorRoles: session.roles,
      entityId,
    });
    const payload = { items: items.map(serializeEntitySlugHistoryItem) };
    assertSafeEntityHttpPayload(payload);
    return editorOk(payload);
  });
}
