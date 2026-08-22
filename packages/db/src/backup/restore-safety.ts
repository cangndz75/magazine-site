export type RestoreDatabaseSafety =
  | {
      ok: true;
      databaseName: string;
      host: string;
    }
  | {
      ok: false;
      reason: string;
    };

const LOCAL_RESTORE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const UNSAFE_NAME_PATTERN = /(^|[_-])(prod|production|staging|stage|live)([_-]|$)/i;

export function inspectRestoreDatabaseUrl(
  databaseUrl: string | undefined,
): RestoreDatabaseSafety {
  if (!databaseUrl) {
    return { ok: false, reason: "RESTORE_DATABASE_URL is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return { ok: false, reason: "RESTORE_DATABASE_URL is not a valid URL." };
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    return {
      ok: false,
      reason: "RESTORE_DATABASE_URL must use postgres:// or postgresql://.",
    };
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!databaseName) {
    return { ok: false, reason: "Restore database name is missing." };
  }

  if (!databaseName.endsWith("_restore_test")) {
    return {
      ok: false,
      reason: "Restore database name must end with _restore_test.",
    };
  }

  const host = parsed.hostname;
  if (!LOCAL_RESTORE_HOSTS.has(host)) {
    return {
      ok: false,
      reason: "Restore database host must be local for this pass.",
    };
  }

  if (UNSAFE_NAME_PATTERN.test(databaseName) || UNSAFE_NAME_PATTERN.test(host)) {
    return {
      ok: false,
      reason: "Restore destination contains production-looking markers.",
    };
  }

  return { ok: true, databaseName, host };
}

export function assertSafeRestoreDatabaseUrl(databaseUrl: string | undefined): {
  databaseName: string;
  host: string;
} {
  const safety = inspectRestoreDatabaseUrl(databaseUrl);
  if (!safety.ok) {
    throw new Error(`Unsafe restore destination: ${safety.reason}`);
  }
  return { databaseName: safety.databaseName, host: safety.host };
}
