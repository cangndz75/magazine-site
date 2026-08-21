import { CAPABILITY } from "@magazine/domain";
import { revokeAllStaffSessions } from "@magazine/db/staff-administration";
import { withEditorWrite } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import {
  currentSessionIdForRevokeAll,
  staffAdminActorFromSession,
} from "@/lib/staff/actor";
import {
  parseRevokeAllSessionsBody,
  parseStaffUserId,
} from "@/lib/staff/payload";
import { assertSafeStaffHttpPayload } from "@/lib/staff/serialize";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ staffUserId: string }> },
) {
  return withEditorWrite(
    request,
    CAPABILITY.STAFF_MANAGE,
    async (session, body) => {
      const { staffUserId } = await context.params;
      const targetStaffUserId = parseStaffUserId(staffUserId);
      const parsed = parseRevokeAllSessionsBody(body);
      const currentSessionId = currentSessionIdForRevokeAll({
        actorStaffUserId: session.staffUserId,
        actorSessionId: session.sessionId,
        targetStaffUserId,
        includeCurrentSession: parsed.includeCurrentSession,
      });
      const result = await revokeAllStaffSessions({
        actor: staffAdminActorFromSession(session, currentSessionId),
        staffUserId: targetStaffUserId,
      });
      const payload = {
        revokedSessionCount: result.revokedSessionCount,
        preservedSessionId: result.preservedSessionId,
        preservedCurrentSession: result.preservedSessionId === session.sessionId,
      };
      assertSafeStaffHttpPayload(payload);
      return editorOk(payload);
    },
  );
}
