import { findPotentialEntityDuplicates } from "@magazine/db/entities";
import { withEntityManagerRead } from "@/lib/entity/route-auth";
import { parseEntityDuplicateQuery } from "@/lib/entity/payload";
import {
  assertSafeEntityHttpPayload,
  serializeEntityDuplicate,
} from "@/lib/entity/serialize";
import { editorOk } from "@/lib/content/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEntityManagerRead(request, async (session) => {
    const query = parseEntityDuplicateQuery(new URL(request.url));
    const signals = await findPotentialEntityDuplicates({
      actorRoles: session.roles,
      canonicalName: query.canonicalName,
      aliases: query.aliases,
      excludeEntityId: query.excludeEntityId,
    });
    const payload = { items: signals.map(serializeEntityDuplicate) };
    assertSafeEntityHttpPayload(payload);
    return editorOk(payload);
  });
}
