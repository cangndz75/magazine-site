import { CAPABILITY } from "@magazine/domain";
import { setStaffAccountStatus } from "@magazine/db/staff-administration";
import { withEditorWrite } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { staffAdminActorFromSession } from "@/lib/staff/actor";
import { parseStaffStatusBody, parseStaffUserId } from "@/lib/staff/payload";
import {
  assertSafeStaffHttpPayload,
  serializeStaffAccountDetail,
} from "@/lib/staff/serialize";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ staffUserId: string }> },
) {
  return withEditorWrite(
    request,
    CAPABILITY.STAFF_MANAGE,
    async (session, body) => {
      const { staffUserId } = await context.params;
      const parsed = parseStaffStatusBody(body);
      const account = await setStaffAccountStatus({
        actor: staffAdminActorFromSession(session),
        staffUserId: parseStaffUserId(staffUserId),
        status: parsed.status,
        expectedUpdatedAt: parsed.expectedUpdatedAt,
      });
      const payload = serializeStaffAccountDetail(account);
      assertSafeStaffHttpPayload(payload);
      return editorOk(payload);
    },
  );
}
