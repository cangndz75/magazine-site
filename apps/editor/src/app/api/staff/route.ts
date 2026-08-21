import { CAPABILITY } from "@magazine/domain";
import { listStaffAccounts } from "@magazine/db/staff-administration";
import { withEditorRead } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { staffAdminActorFromSession } from "@/lib/staff/actor";
import { parseStaffListQuery } from "@/lib/staff/payload";
import {
  assertSafeStaffHttpPayload,
  serializeStaffAccountListItem,
} from "@/lib/staff/serialize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.STAFF_MANAGE, async (session) => {
    const query = parseStaffListQuery(new URL(request.url));
    const result = await listStaffAccounts({
      actor: staffAdminActorFromSession(session),
      search: query.search,
      status: query.status,
      role: query.role,
      scopeMode: query.scopeMode,
      limit: query.limit,
      cursor: query.cursor,
    });
    const payload = {
      items: result.items.map(serializeStaffAccountListItem),
      nextCursor: result.nextCursor,
    };
    assertSafeStaffHttpPayload(payload);
    return editorOk(payload);
  });
}
