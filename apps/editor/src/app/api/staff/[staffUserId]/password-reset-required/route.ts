import { CAPABILITY } from "@magazine/domain";
import { requireStaffPasswordReset } from "@magazine/db/staff-administration";
import { withEditorWrite } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { staffAdminActorFromSession } from "@/lib/staff/actor";
import {
  parseExpectedUpdatedAtBody,
  parseStaffUserId,
} from "@/lib/staff/payload";
import {
  assertSafeStaffHttpPayload,
  serializeStaffAccountDetail,
} from "@/lib/staff/serialize";

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
      const parsed = parseExpectedUpdatedAtBody(body);
      const account = await requireStaffPasswordReset({
        actor: staffAdminActorFromSession(session),
        staffUserId: parseStaffUserId(staffUserId),
        expectedUpdatedAt: parsed.expectedUpdatedAt,
      });
      const payload = serializeStaffAccountDetail(account);
      assertSafeStaffHttpPayload(payload);
      return editorOk(payload);
    },
  );
}
