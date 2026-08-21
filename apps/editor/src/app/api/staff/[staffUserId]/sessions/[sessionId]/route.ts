import { CAPABILITY } from "@magazine/domain";
import { revokeStaffSession } from "@magazine/db/staff-administration";
import { withEditorMutation } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { staffAdminActorFromSession } from "@/lib/staff/actor";
import { parseStaffSessionId, parseStaffUserId } from "@/lib/staff/payload";
import { assertSafeStaffHttpPayload } from "@/lib/staff/serialize";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ staffUserId: string; sessionId: string }> },
) {
  return withEditorMutation(request, CAPABILITY.STAFF_MANAGE, async (session) => {
    const { staffUserId, sessionId } = await context.params;
    const result = await revokeStaffSession({
      actor: staffAdminActorFromSession(session),
      staffUserId: parseStaffUserId(staffUserId),
      sessionId: parseStaffSessionId(sessionId),
    });
    const payload = { revoked: result.revoked };
    assertSafeStaffHttpPayload(payload);
    return editorOk(payload);
  });
}
