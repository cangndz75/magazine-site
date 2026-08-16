import "server-only";

import { redirect } from "next/navigation";
import {
  canPerform,
  hasCapability,
  type Capability,
} from "@magazine/domain";
import { getCurrentStaffSession, type StaffSessionContext } from "./session";

export class AuthorizationError extends Error {
  readonly status = 403;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireStaffSession(): Promise<StaffSessionContext> {
  const session = await getCurrentStaffSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireCapability(
  capability: Capability,
): Promise<StaffSessionContext> {
  const session = await requireStaffSession();
  if (!hasCapability(session.roles, capability)) {
    throw new AuthorizationError();
  }
  return session;
}

export async function requireCategoryCapability(
  capability: Capability,
  categoryId: string,
): Promise<StaffSessionContext> {
  const session = await requireStaffSession();
  const allowed = canPerform({
    roles: session.roles,
    capability,
    scopeMode: session.scopeMode,
    scopedCategoryIds: session.scopedCategoryIds,
    categoryId,
  });

  if (!allowed) {
    throw new AuthorizationError();
  }

  return session;
}
