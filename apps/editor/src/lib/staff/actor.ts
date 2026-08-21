import type { StaffAdminActor } from "@magazine/db/staff-administration";
import type { StaffSessionContext } from "@/lib/auth/session";

export function staffAdminActorFromSession(
  session: Pick<StaffSessionContext, "staffUserId" | "roles" | "sessionId">,
  currentSessionId: string | null = null,
): StaffAdminActor {
  return {
    staffUserId: session.staffUserId,
    roles: session.roles,
    currentSessionId,
  };
}

/**
 * HTTP layer owns current-session identity. Request bodies are ignored.
 *
 * Self revoke-all preserves the authenticated session unless the caller
 * explicitly opts into includeCurrentSession. Targeting another user never
 * preserves any of the target's sessions, even if a body supplies an id.
 */
export function currentSessionIdForRevokeAll(input: {
  actorStaffUserId: string;
  actorSessionId: string;
  targetStaffUserId: string;
  includeCurrentSession: boolean;
}): string | null {
  if (input.actorStaffUserId !== input.targetStaffUserId) {
    return null;
  }
  if (input.includeCurrentSession) {
    return null;
  }
  return input.actorSessionId;
}
