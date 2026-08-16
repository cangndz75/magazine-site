import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(packageRoot, "package.json"));

const dedicated = process.env.EDITOR_CONTENT_TEST_DATABASE_URL ?? "";

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
