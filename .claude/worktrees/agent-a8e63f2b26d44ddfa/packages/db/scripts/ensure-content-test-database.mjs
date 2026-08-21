import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const TEST_DATABASE_NAME = /^[a-z][a-z0-9_]*_test$/;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const envPaths = [
  path.join(repoRoot, "apps/editor/.env.local"),
  path.join(repoRoot, ".env.local"),
];

function readEnvValue(filePath, key) {
  if (!existsSync(filePath)) {
    return null;
  }
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    if (trimmed.slice(0, separator) !== key) {
      continue;
    }
    return trimmed.slice(separator + 1).replace(/^['"]|['"]$/g, "");
  }
  return null;
}

function loadTestUrl() {
  if (process.env.EDITOR_CONTENT_TEST_DATABASE_URL) {
    return process.env.EDITOR_CONTENT_TEST_DATABASE_URL;
  }
  for (const envPath of envPaths) {
    const value = readEnvValue(envPath, "EDITOR_CONTENT_TEST_DATABASE_URL");
    if (value) {
      return value;
    }
  }
  return null;
}

const raw = loadTestUrl();
if (!raw) {
  console.error(
    "EDITOR_CONTENT_TEST_DATABASE_URL is missing from the environment and ignored local env files.",
  );
  process.exit(1);
}

if (!raw.startsWith("postgres://") && !raw.startsWith("postgresql://")) {
  console.error("EDITOR_CONTENT_TEST_DATABASE_URL must be a postgres:// or postgresql:// URL.");
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(raw);
} catch {
  console.error("EDITOR_CONTENT_TEST_DATABASE_URL is not a valid URL.");
  process.exit(1);
}

const host = parsed.hostname.trim().toLowerCase();
const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, "")).trim();
if (!LOOPBACK_HOSTS.has(host)) {
  console.error("Refusing a non-loopback PostgreSQL host for the dedicated *_test database.");
  process.exit(1);
}
if (!TEST_DATABASE_NAME.test(database)) {
  console.error(`Refusing database name that does not end with _test.`);
  process.exit(1);
}

console.log(
  `Preparing dedicated test database ${host}:${parsed.port || "5432"}/${database}`,
);

const adminUrl = new URL(raw);
adminUrl.pathname = "/postgres";
const admin = new Client({
  connectionString: adminUrl.toString(),
  application_name: "magazine_ensure_content_test_db",
});

try {
  await admin.connect();
} catch (error) {
  console.error(
    "Could not connect to local PostgreSQL on loopback to create the dedicated *_test database.",
  );
  if (error && typeof error === "object") {
    const code = "code" in error ? String(error.code) : "";
    const message = error instanceof Error ? error.message : "";
    console.error([code, message].filter(Boolean).join(": ") || "unknown connection error");
  }
  process.exit(1);
}

try {
  const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
    database,
  ]);
  if (existing.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${database}"`);
    console.log(
      "Created empty dedicated test database. Schema is applied by the integration harness.",
    );
  } else {
    console.log("Dedicated test database already exists.");
  }
} finally {
  await admin.end();
}
