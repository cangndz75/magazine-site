import { CAPABILITY } from "@magazine/domain";
import { listStaffSecurityAuditEvents } from "@magazine/db/staff-administration";
import { withEditorRead } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { staffAdminActorFromSession } from "@/lib/staff/actor";
import { parseStaffUserId } from "@/lib/staff/payload";
import {
  shortenStaffId,
  staffSecurityAuditEventLabel,
  summarizeStaffSecurityAuditChangeSet,
} from "@/lib/staff/presentation";
import type { StaffSecurityAuditEventType } from "@magazine/domain";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ staffUserId: string }> },
) {
  return withEditorRead(request, CAPABILITY.STAFF_MANAGE, async (session) => {
    const { staffUserId } = await context.params;
    const events = await listStaffSecurityAuditEvents({
      actor: staffAdminActorFromSession(session),
      staffUserId: parseStaffUserId(staffUserId),
    });

    const items = events.map((event) => ({
      id: event.id,
      eventLabel: staffSecurityAuditEventLabel(
        event.eventType as StaffSecurityAuditEventType,
      ),
      actorLabel:
        event.actorKind === "STAFF" && event.actorStaffUserId
          ? shortenStaffId(event.actorStaffUserId)
          : "Sistem",
      occurredAt: event.occurredAt.toISOString(),
      summary: summarizeStaffSecurityAuditChangeSet(event.changeSet),
    }));

    return editorOk({ items });
  });
}
