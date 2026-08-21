import { CAPABILITY } from "@magazine/domain";
import { setStaffRoles } from "@magazine/db/staff-administration";
import { withEditorWrite } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { staffAdminActorFromSession } from "@/lib/staff/actor";
import { parseStaffRolesBody, parseStaffUserId } from "@/lib/staff/payload";
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
      const parsed = parseStaffRolesBody(body);
      const account = await setStaffRoles({
        actor: staffAdminActorFromSession(session),
        staffUserId: parseStaffUserId(staffUserId),
        roles: parsed.roles,
        expectedUpdatedAt: parsed.expectedUpdatedAt,
      });
      const payload = serializeStaffAccountDetail(account);
      assertSafeStaffHttpPayload(payload);
      return editorOk(payload);
    },
  );
}
