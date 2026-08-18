import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "../..");
const require = createRequire(path.join(packageRoot, "package.json"));

const DEDICATED_URL_ENV = "EDITOR_CONTENT_TEST_DATABASE_URL";

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

function loadDedicatedTestUrl() {
  const fromProcess = process.env[DEDICATED_URL_ENV]?.trim() ?? "";
  if (fromProcess) {
    return fromProcess;
  }

  const localFiles = [
    path.join(repoRoot, "apps/editor/.env.local"),
    path.join(repoRoot, ".env.local"),
  ];
  for (const filePath of localFiles) {
    const value = readEnvValue(filePath, DEDICATED_URL_ENV);
    if (value) {
      return value;
    }
  }
  return "";
}

const dedicated = loadDedicatedTestUrl();

if (!dedicated.startsWith("postgres://") && !dedicated.startsWith("postgresql://")) {
  console.error(
    "@magazine/db test:integration requires EDITOR_CONTENT_TEST_DATABASE_URL.",
  );
  console.error(
    "Set it to a dedicated local PostgreSQL database whose name ends with _test.",
  );
  console.error(
    "This command does not read DATABASE_URL and will not use staging or production.",
  );
  process.exit(1);
}

let tsxCli;
try {
  tsxCli = require.resolve("tsx/cli");
} catch {
  console.error("tsx is required to run @magazine/db integration tests.");
  process.exit(1);
}

const env = {
  ...process.env,
  [DEDICATED_URL_ENV]: dedicated,
  EDITOR_CONTENT_INTEGRATION: "1",
  DATABASE_URL: "",
};

const child = spawn(
  process.execPath,
  [tsxCli, "--test", "--test-concurrency=1", "src/integration/**/*.test.ts"],
  {
    cwd: packageRoot,
    stdio: "inherit",
    env,
    shell: false,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 1);
});
