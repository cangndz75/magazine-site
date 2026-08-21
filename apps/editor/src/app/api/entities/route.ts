import { encodeEditorListCursor } from "@magazine/domain";
import { createEntity, listEntities } from "@magazine/db/entities";
import { withEntityManagerRead, withEntityManagerWrite } from "@/lib/entity/route-auth";
import { entityStaffActorFromSession } from "@/lib/entity/actor";
import { parseEntityCreateBody, parseEntityListQuery } from "@/lib/entity/payload";
import {
  assertSafeEntityHttpPayload,
  serializeEntityDetail,
  serializeEntityListItem,
} from "@/lib/entity/serialize";
import { editorOk } from "@/lib/content/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEntityManagerRead(request, async (session) => {
    const query = parseEntityListQuery(new URL(request.url));
    const result = await listEntities({
      actorRoles: session.roles,
      q: query.search ?? undefined,
      kind: query.kind,
      status: query.status,
      missingPortrait: query.missingPortrait,
      limit: query.limit,
      cursor: query.cursor ? encodeEditorListCursor(query.cursor) : undefined,
    });
    const payload = {
      items: result.items.map(serializeEntityListItem),
      nextCursor: result.nextCursor,
    };
    assertSafeEntityHttpPayload(payload);
    return editorOk(payload);
  });
}

export async function POST(request: Request) {
  return withEntityManagerWrite(request, async (session, body) => {
    const profile = parseEntityCreateBody(body);
    const created = await createEntity({
      actor: entityStaffActorFromSession(session),
      profile,
    });
    const payload = serializeEntityDetail(created);
    assertSafeEntityHttpPayload(payload);
    return editorOk(payload, 201);
  });
}
