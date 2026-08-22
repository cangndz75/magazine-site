import type { RedirectActor } from "@magazine/db/redirects";
import type { StaffSessionContext } from "@/lib/auth/session";

export function redirectActorFromSession(
  session: Pick<StaffSessionContext, "staffUserId" | "roles">,
): RedirectActor {
  return {
    staffUserId: session.staffUserId,
    roles: session.roles,
  };
}
