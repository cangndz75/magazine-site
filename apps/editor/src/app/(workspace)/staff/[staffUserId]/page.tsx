import { CAPABILITY, type StaffSecurityAuditEventType } from "@magazine/domain";
import {
  getStaffAccount,
  listStaffSecurityAuditEvents,
  listStaffSessions,
} from "@magazine/db/staff-administration";
import { lookupEditorCategories } from "@magazine/db/editor";
import { StaffDetailWorkspace } from "@/components/staff-detail-workspace";
import type { StaffSecurityAuditItem } from "@/components/staff-security-audit-timeline";
import { requireCapability } from "@/lib/auth/authorization";
import { staffAdminActorFromSession } from "@/lib/staff/actor";
import { parseStaffUserId } from "@/lib/staff/payload";
import {
  shortenStaffId,
  staffSecurityAuditEventLabel,
  summarizeStaffSecurityAuditChangeSet,
} from "@/lib/staff/presentation";
import {
  serializeStaffAccountDetail,
  serializeStaffSessionList,
} from "@/lib/staff/serialize";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Personel detayı",
};

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ staffUserId: string }>;
}) {
  const session = await requireCapability(CAPABILITY.STAFF_MANAGE);
  const { staffUserId: rawId } = await params;
  const staffUserId = parseStaffUserId(rawId);
  const actor = staffAdminActorFromSession(session);

  const [accountRow, sessionsRow, auditEvents, categories] = await Promise.all([
    getStaffAccount({ actor, staffUserId }),
    listStaffSessions({ actor, staffUserId }),
    listStaffSecurityAuditEvents({ actor, staffUserId }),
    lookupEditorCategories({ scopedCategoryIds: [] }),
  ]);

  const account = serializeStaffAccountDetail(accountRow);
  const { sessions } = serializeStaffSessionList(sessionsRow);

  const categoryLabels = Object.fromEntries(
    categories.map((category) => [category.id, category.name]),
  );

  const auditItems: StaffSecurityAuditItem[] = auditEvents.map((event) => ({
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

  return (
    <StaffDetailWorkspace
      initialAccount={account}
      initialSessions={sessions}
      auditItems={auditItems}
      categoryLabels={categoryLabels}
      actorStaffUserId={session.staffUserId}
    />
  );
}
