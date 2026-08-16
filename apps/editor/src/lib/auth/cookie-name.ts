import type { EditorEnv } from "@magazine/config/env/editor";

export const DEVELOPMENT_SESSION_COOKIE = "magazine-editor-session";
export const PRODUCTION_SESSION_COOKIE = "__Host-magazine-editor-session";

export function usesHostPrefixCookie(appEnv: EditorEnv["APP_ENV"]): boolean {
  return appEnv === "production" || appEnv === "staging";
}

export function editorSessionCookieName(
  appEnv: EditorEnv["APP_ENV"],
): string {
  return usesHostPrefixCookie(appEnv)
    ? PRODUCTION_SESSION_COOKIE
    : DEVELOPMENT_SESSION_COOKIE;
}
