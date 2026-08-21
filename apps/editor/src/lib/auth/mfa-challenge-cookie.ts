import { env } from "@/lib/env";
import type { EditorEnv } from "@magazine/config/env/editor";
import {
  sessionCookieClearOptions,
  sessionCookieOptions,
} from "./cookie-options";

const MFA_CHALLENGE_COOKIE_BASE = "magazine-editor-mfa-challenge";
const MFA_CHALLENGE_MAX_AGE_SECONDS = 10 * 60;

export function mfaChallengeCookieName(appEnv: string): string {
  if (appEnv === "production" || appEnv === "staging") {
    return `__Host-${MFA_CHALLENGE_COOKIE_BASE}`;
  }
  return MFA_CHALLENGE_COOKIE_BASE;
}

export function mfaChallengeCookieOptions(appEnv: EditorEnv["APP_ENV"]) {
  const base = sessionCookieOptions(appEnv);
  return {
    ...base,
    maxAge: MFA_CHALLENGE_MAX_AGE_SECONDS,
  };
}

export function mfaChallengeCookieClearOptions(appEnv: EditorEnv["APP_ENV"]) {
  return sessionCookieClearOptions(appEnv);
}

export async function applyMfaChallengeCookie(token: string): Promise<void> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set(
    mfaChallengeCookieName(env.APP_ENV),
    token,
    mfaChallengeCookieOptions(env.APP_ENV),
  );
}

export async function readMfaChallengeTokenFromCookie(): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return jar.get(mfaChallengeCookieName(env.APP_ENV))?.value;
}

export async function clearMfaChallengeCookie(): Promise<void> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set(
    mfaChallengeCookieName(env.APP_ENV),
    "",
    mfaChallengeCookieClearOptions(env.APP_ENV),
  );
}
