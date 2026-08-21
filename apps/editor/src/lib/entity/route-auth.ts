import "server-only";

import { CAPABILITY } from "@magazine/domain";
import {
  requireEditorApiSession,
  withEditorMutation,
  withEditorRead,
  withEditorWrite,
} from "@/lib/content/api-auth";
import { mapEditorError } from "@/lib/content/http";
import { requireEntityWriteCapability } from "./api-auth";

export async function withEntityManagerRead(
  request: Request,
  handler: Parameters<typeof withEditorRead>[2],
): Promise<Response> {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async (session) => {
    requireEntityWriteCapability(session);
    return handler(session);
  });
}

export async function withEntityManagerWrite(
  request: Request,
  handler: Parameters<typeof withEditorWrite>[2],
): Promise<Response> {
  return withEditorWrite(request, CAPABILITY.CONTENT_READ, async (session, body) => {
    requireEntityWriteCapability(session);
    return handler(session, body);
  });
}

export async function withEntityManagerMutation(
  request: Request,
  handler: Parameters<typeof withEditorMutation>[2],
): Promise<Response> {
  return withEditorMutation(request, CAPABILITY.CONTENT_READ, async (session, req) => {
    requireEntityWriteCapability(session);
    return handler(session, req);
  });
}

export async function requireEntityManagerSession() {
  const session = await requireEditorApiSession();
  requireEntityWriteCapability(session);
  return session;
}
