import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  authenticateStaffPassword,
  LOGIN_FAILURE_CODE,
} from "@/lib/auth/authenticate";
import { assertEditorOrigin, safeInternalPath } from "@/lib/auth/origin";
import {
  applyMfaChallengeCookie,
  clearMfaChallengeCookie,
} from "@/lib/auth/mfa-challenge-cookie";
import { applySessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function loginErrorRedirect() {
  const url = new URL("/login", env.EDITOR_URL);
  url.searchParams.set("error", "1");
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  try {
    assertEditorOrigin(request, env.EDITOR_URL);
  } catch {
    return loginErrorRedirect();
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const returnTo = safeInternalPath(
    typeof form.get("returnTo") === "string"
      ? String(form.get("returnTo"))
      : null,
  );

  const result = await authenticateStaffPassword(email, password);
  if (!result.ok) {
    if (result.code === LOGIN_FAILURE_CODE.PASSWORD_RESET_REQUIRED) {
      return NextResponse.redirect(
        new URL("/login?reset_required=1", env.EDITOR_URL),
        303,
      );
    }
    return loginErrorRedirect();
  }

  if (result.kind === "mfa_required") {
    const response = NextResponse.redirect(
      new URL(`/login?mfa=1&returnTo=${encodeURIComponent(returnTo)}`, env.EDITOR_URL),
      303,
    );
    await applyMfaChallengeCookie(result.challengeToken);
    return response;
  }

  await clearMfaChallengeCookie();
  await applySessionCookie(result.token);
  return NextResponse.redirect(new URL(returnTo, env.EDITOR_URL), 303);
}
