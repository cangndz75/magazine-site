import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@magazine/db/client";
import { getSelfServiceMfaStatus } from "@magazine/db/staff-mfa";
import { staffUsers } from "@magazine/db/schema";
import { requireStaffSession } from "@/lib/auth/authorization";
import { SecuritySettingsWorkspace } from "@/components/security-settings-workspace";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const session = await requireStaffSession();
  const db = getDb();
  const [user] = await db
    .select({
      passwordResetRequiredAt: staffUsers.passwordResetRequiredAt,
    })
    .from(staffUsers)
    .where(eq(staffUsers.id, session.staffUserId))
    .limit(1);

  if (!user) {
    redirect("/login");
  }

  const mfa = await getSelfServiceMfaStatus(session.staffUserId);

  return (
    <SecuritySettingsWorkspace
      initial={{
        email: session.email,
        displayName: session.displayName,
        passwordResetRequired: user.passwordResetRequiredAt !== null,
        mfa: {
          enrolled: mfa.enrolled,
          status: mfa.status,
          unusedRecoveryCodeCount: mfa.unusedRecoveryCodeCount,
        },
      }}
    />
  );
}
