import "server-only";

import { authorizeEntityWrite } from "@magazine/domain";
import type { StaffSessionContext } from "@/lib/auth/session";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";

export function requireEntityWriteCapability(session: StaffSessionContext): void {
  const decision = authorizeEntityWrite({ roles: session.roles });
  if (!decision.ok) {
    throw new EditorHttpError(
      403,
      EDITOR_API_ERROR.FORBIDDEN,
      "You are not allowed to perform this action.",
    );
  }
}
