import { NextRequest, NextResponse } from "next/server";
import { getEditorEnv } from "@magazine/config/env/editor";
import { editorSessionCookieName } from "@/lib/auth/cookie-name";
import { isEditorSessionExemptPath } from "@/lib/auth/proxy-paths";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  if (isEditorSessionExemptPath(pathname)) {
    return NextResponse.next();
  }

  const env = getEditorEnv();
  const cookieName = editorSessionCookieName(env.APP_ENV);
  const hasSessionCookie = request.cookies.has(cookieName);

  if (!hasSessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required.",
          },
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "private, no-store",
          },
        },
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
