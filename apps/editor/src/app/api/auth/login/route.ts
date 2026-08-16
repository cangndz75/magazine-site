import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { authenticateStaffPassword } from "@/lib/auth/authenticate";
import { assertEditorOrigin, safeInternalPath } from "@/lib/auth/origin";
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
    return loginErrorRedirect();
  }

  await applySessionCookie(result.token);
  return NextResponse.redirect(new URL(returnTo, env.EDITOR_URL), 303);
}
