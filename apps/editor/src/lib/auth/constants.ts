import "server-only";

import { SESSION_LIFETIME_MS } from "@magazine/domain";

export {
  DEVELOPMENT_SESSION_COOKIE,
  PRODUCTION_SESSION_COOKIE,
  editorSessionCookieName,
  usesHostPrefixCookie,
} from "./cookie-name";

export const GENERIC_LOGIN_ERROR = "Invalid email or password.";
export const SESSION_MAX_AGE_SECONDS = SESSION_LIFETIME_MS / 1000;
