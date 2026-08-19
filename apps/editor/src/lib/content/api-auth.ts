import "server-only";

import { type Capability } from "@magazine/domain";
import { env } from "@/lib/env";
import { assertEditorOrigin } from "@/lib/auth/origin";
import {
  getCurrentStaffSession,
  type StaffSessionContext,
} from "@/lib/auth/session";
import {
  EDITOR_API_ERROR,
  EditorHttpError,
  mapEditorError,
  readEditorJsonBody,
} from "./http";
import { requireEditorCapability } from "./capability-check";

export async function requireEditorApiSession(): Promise<StaffSessionContext> {
  const session = await getCurrentStaffSession();
  if (!session) {
    throw new EditorHttpError(
      401,
      EDITOR_API_ERROR.UNAUTHENTICATED,
      "Authentication required.",
    );
  }

  return session;
}

export function assertUnsafeEditorOrigin(request: Request): void {
  try {
    assertEditorOrigin(request, env.EDITOR_URL);
  } catch {
    throw new EditorHttpError(
      403,
      EDITOR_API_ERROR.CROSS_ORIGIN_REJECTED,
      "Cross-origin request rejected.",
    );
  }
}

export async function withEditorRead(
  _request: Request,
  capability: Capability,
  handler: (session: StaffSessionContext) => Promise<Response>,
): Promise<Response> {
  try {
    const session = await requireEditorApiSession();
    requireEditorCapability(session, capability);
    return await handler(session);
  } catch (error) {
    return mapEditorError(error);
  }
}

export async function withEditorWrite(
  request: Request,
  capability: Capability,
  handler: (
    session: StaffSessionContext,
    body: unknown,
  ) => Promise<Response>,
): Promise<Response> {
  try {
    assertUnsafeEditorOrigin(request);
    const session = await requireEditorApiSession();
    requireEditorCapability(session, capability);
    const body = await readEditorJsonBody(request);
    return await handler(session, body);
  } catch (error) {
    return mapEditorError(error);
  }
}
