import { NextRequest, NextResponse } from "next/server";
import { getEditorEnv } from "@magazine/config/env/editor";
import { editorSessionCookieName } from "@/lib/auth/cookie-name";

const PUBLIC_PATHS = new Set(["/login", "/api/health"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  if (pathname.startsWith("/api/auth/login")) {
    return true;
  }

  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const env = getEditorEnv();
  const cookieName = editorSessionCookieName(env.APP_ENV);
  const hasSessionCookie = request.cookies.has(cookieName);

  if (!hasSessionCookie) {
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
