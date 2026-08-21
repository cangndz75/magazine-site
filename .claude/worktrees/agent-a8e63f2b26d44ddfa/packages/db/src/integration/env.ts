const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const FORBIDDEN_APP_ENV = new Set(["production", "staging"]);
const TEST_DATABASE_NAME = /^[a-z][a-z0-9_]*_test$/;

export const EDITOR_CONTENT_TEST_DATABASE_URL_ENV =
  "EDITOR_CONTENT_TEST_DATABASE_URL";

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeTestDatabaseError";
  }
}

export type SafeTestDatabaseUrl = {
  connectionString: string;
  host: string;
  port: string;
  database: string;
};

function describeTarget(host: string, database: string): string {
  return `${host}/${database}`;
}

/**
 * Parse and validate the dedicated integration-test URL.
 * Never reads DATABASE_URL. Never accepts staging/production APP_ENV.
 */
export function parseEditorContentTestDatabaseUrl(
  raw: string | undefined,
  env: Record<string, string | undefined> = process.env,
): SafeTestDatabaseUrl {
  const appEnv = env.APP_ENV ?? "development";
  if (FORBIDDEN_APP_ENV.has(appEnv)) {
    throw new UnsafeTestDatabaseError(
      `Refusing to run editor content integration tests because APP_ENV=${appEnv}. Use a local test environment only.`,
    );
  }

  const value = raw?.trim() ?? "";
  if (value.length === 0) {
    throw new UnsafeTestDatabaseError(
      `${EDITOR_CONTENT_TEST_DATABASE_URL_ENV} is required. Integration tests do not fall back to DATABASE_URL, staging, or production.`,
    );
  }

  if (!value.startsWith("postgres://") && !value.startsWith("postgresql://")) {
    throw new UnsafeTestDatabaseError(
      `${EDITOR_CONTENT_TEST_DATABASE_URL_ENV} must be a postgres:// or postgresql:// URL.`,
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UnsafeTestDatabaseError(
      `${EDITOR_CONTENT_TEST_DATABASE_URL_ENV} is not a valid URL.`,
    );
  }

  const host = url.hostname.trim().toLowerCase();
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new UnsafeTestDatabaseError(
      `Refusing ${describeTarget(host, url.pathname)}: editor content integration tests may only use a loopback PostgreSQL host.`,
    );
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, "")).trim();
  if (database.includes("/") || database.length === 0) {
    throw new UnsafeTestDatabaseError(
      `${EDITOR_CONTENT_TEST_DATABASE_URL_ENV} must name a single database.`,
    );
  }

  if (!TEST_DATABASE_NAME.test(database)) {
    throw new UnsafeTestDatabaseError(
      `Refusing database "${database}": the dedicated test database name must match ${TEST_DATABASE_NAME} (end with _test).`,
    );
  }

  return {
    connectionString: value,
    host,
    port: url.port || "5432",
    database,
  };
}

export function bindEditorContentTestDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): SafeTestDatabaseUrl {
  const parsed = parseEditorContentTestDatabaseUrl(
    env[EDITOR_CONTENT_TEST_DATABASE_URL_ENV],
    env,
  );

  const url = new URL(parsed.connectionString);
  url.searchParams.set("application_name", "magazine_editor_content_itest");

  env.EDITOR_CONTENT_INTEGRATION = "1";
  env.APP_ENV = "test";
  env.DATABASE_URL = url.toString();

  return parsed;
}
