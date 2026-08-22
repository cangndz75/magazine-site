import { CAPABILITY, authorizeEntityWrite, hasCapability } from "@magazine/domain";
import { EditorAppShell } from "@/components/editor-app-shell";
import { requireStaffSession } from "@/lib/auth/authorization";
import { staffRoleLabel } from "@/lib/staff/presentation";
import { buildWorkspaceNavigation } from "@/lib/workspace/navigation";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaffSession();
  const canReadContent = hasCapability(session.roles, CAPABILITY.CONTENT_READ);
  const canReview = hasCapability(session.roles, CAPABILITY.CONTENT_REVIEW);
  const canPublish = hasCapability(session.roles, CAPABILITY.CONTENT_PUBLISH);
  const canManageHomepage = hasCapability(
    session.roles,
    CAPABILITY.HOMEPAGE_MANAGE,
  );
  const canLegal = hasCapability(session.roles, CAPABILITY.CONTENT_LEGAL);
  const canManageStaff = hasCapability(session.roles, CAPABILITY.STAFF_MANAGE);
  const canManageEntities = authorizeEntityWrite({ roles: session.roles }).ok;
  const canReadAnalytics = hasCapability(
    session.roles,
    CAPABILITY.ANALYTICS_READ,
  );

  const groups = buildWorkspaceNavigation({
    canReadContent,
    canReview,
    canPublish,
    canManageHomepage,
    canLegal,
    canManageStaff,
    canManageEntities,
    canReadAnalytics,
  });

  return (
    <EditorAppShell
      groups={groups}
      displayName={session.displayName}
      roleLabels={session.roles.map(staffRoleLabel)}
    >
      {children}
    </EditorAppShell>
  );
}
