import "server-only";

import { authorizeEntityWrite } from "@magazine/domain";
import {
  AuthorizationError,
  requireStaffSession,
} from "@/lib/auth/authorization";

export async function requireEntityWrite() {
  const session = await requireStaffSession();
  const decision = authorizeEntityWrite({ roles: session.roles });
  if (!decision.ok) {
    throw new AuthorizationError();
  }
  return session;
}
