import { hasCapability, type Capability, type StaffRole } from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "./http";

export function requireEditorCapability(
  session: { roles: readonly StaffRole[] },
  capability: Capability,
): void {
  if (!hasCapability(session.roles, capability)) {
    throw new EditorHttpError(
      403,
      EDITOR_API_ERROR.FORBIDDEN,
      "You are not allowed to perform this action.",
    );
  }
}
