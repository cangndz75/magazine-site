import type { EditorEnv } from "@magazine/config/env/editor";
import { SESSION_LIFETIME_MS } from "@magazine/domain";
import {
  editorSessionCookieName,
  usesHostPrefixCookie,
} from "./cookie-name";

export const SESSION_MAX_AGE_SECONDS = SESSION_LIFETIME_MS / 1000;

export type SessionCookieSetOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export function sessionCookieName(appEnv: EditorEnv["APP_ENV"]): string {
  return editorSessionCookieName(appEnv);
}

export function sessionCookieOptions(
  appEnv: EditorEnv["APP_ENV"],
): SessionCookieSetOptions {
  return {
    httpOnly: true,
    secure: usesHostPrefixCookie(appEnv),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function sessionCookieClearOptions(
  appEnv: EditorEnv["APP_ENV"],
): SessionCookieSetOptions {
  return {
    ...sessionCookieOptions(appEnv),
    maxAge: 0,
  };
}
