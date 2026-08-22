import type { FeatureControlActor } from "@magazine/db/feature-controls";
import type { StaffSessionContext } from "@/lib/auth/session";

export function featureControlActorFromSession(
  session: Pick<StaffSessionContext, "staffUserId" | "roles">,
): FeatureControlActor {
  return {
    staffUserId: session.staffUserId,
    roles: session.roles,
  };
}
