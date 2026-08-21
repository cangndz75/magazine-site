import { CAPABILITY } from "@magazine/domain";
import { listStaffSessions } from "@magazine/db/staff-administration";
import { withEditorRead } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { staffAdminActorFromSession } from "@/lib/staff/actor";
import { parseStaffUserId } from "@/lib/staff/payload";
import {
  assertSafeStaffHttpPayload,
  serializeStaffSessionList,
} from "@/lib/staff/serialize";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ staffUserId: string }> },
) {
  return withEditorRead(request, CAPABILITY.STAFF_MANAGE, async (session) => {
    const { staffUserId } = await context.params;
    const sessions = await listStaffSessions({
      actor: staffAdminActorFromSession(session),
      staffUserId: parseStaffUserId(staffUserId),
    });
    const payload = serializeStaffSessionList(sessions);
    assertSafeStaffHttpPayload(payload);
    return editorOk(payload);
  });
}
