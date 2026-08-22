export type PostgresToolEnv = NodeJS.ProcessEnv;

export function postgresUrlToToolEnv(
  databaseUrl: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
): PostgresToolEnv {
  const parsed = new URL(databaseUrl);
  const env: NodeJS.ProcessEnv = { ...baseEnv };

  env.PGHOST = parsed.hostname;
  env.PGDATABASE = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (parsed.port) {
    env.PGPORT = parsed.port;
  }
  if (parsed.username) {
    env.PGUSER = decodeURIComponent(parsed.username);
  }
  if (parsed.password) {
    env.PGPASSWORD = decodeURIComponent(parsed.password);
  }
  const sslMode = parsed.searchParams.get("sslmode");
  if (sslMode) {
    env.PGSSLMODE = sslMode;
  }

  return env;
}
