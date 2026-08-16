import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { assertEditorOrigin } from "@/lib/auth/origin";
import {
  clearSessionCookie,
  getCurrentStaffSession,
  revokeStaffSession,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertEditorOrigin(request, env.EDITOR_URL);
  } catch {
    return NextResponse.redirect(new URL("/login", env.EDITOR_URL), 303);
  }

  const session = await getCurrentStaffSession();
  if (session) {
    await revokeStaffSession(session.sessionId);
  }

  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", env.EDITOR_URL), 303);
}
