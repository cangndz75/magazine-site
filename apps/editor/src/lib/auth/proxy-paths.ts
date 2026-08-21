export function isEditorSessionExemptPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/api/health") {
    return true;
  }

  if (pathname.startsWith("/api/auth/login")) {
    return true;
  }

  if (pathname.startsWith("/api/auth/mfa/challenge/verify")) {
    return true;
  }

  // Machine-authenticated scheduler/outbox routes authenticate in the handler.
  // The session proxy must not consume those requests as staff logins.
  return pathname.startsWith("/api/internal/");
}
