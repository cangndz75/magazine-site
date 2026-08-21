import type { StaffSessionContext } from "@/lib/auth/session";
import type { EntityStaffActor } from "@magazine/db/entities";

export function entityStaffActorFromSession(
  session: StaffSessionContext,
): EntityStaffActor {
  return {
    staffUserId: session.staffUserId,
    roles: session.roles,
  };
}
