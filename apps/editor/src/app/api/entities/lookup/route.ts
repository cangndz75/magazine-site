import { listEditorEntityPicker } from "@magazine/db/entities";
import { withEntityManagerRead } from "@/lib/entity/route-auth";
import { parseEntityLookupQuery } from "@/lib/entity/payload";
import {
  assertSafeEntityHttpPayload,
  serializeEntityPickerItem,
} from "@/lib/entity/serialize";
import { editorOk } from "@/lib/content/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEntityManagerRead(request, async (session) => {
    const query = parseEntityLookupQuery(new URL(request.url));
    const items = await listEditorEntityPicker({
      actorRoles: session.roles,
      q: query.q ?? undefined,
      limit: query.limit,
    });
    const payload = { items: items.map(serializeEntityPickerItem) };
    assertSafeEntityHttpPayload(payload);
    return editorOk(payload);
  });
}
