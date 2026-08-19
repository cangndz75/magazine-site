import process from "node:process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { closeDb } from "@magazine/db/client";
import {
  STAFF_BOOTSTRAP_ERROR,
  StaffBootstrapError,
  bootstrapInitialStaff,
} from "@magazine/db/staff-provisioning";
import { STAFF_ROLE, STAFF_SCOPE_MODE } from "@magazine/domain";
import {
  BootstrapCliInputError,
  assertBootstrapPassword,
  assertPasswordConfirmation,
  normalizeBootstrapDisplayName,
  normalizeBootstrapEmail,
  parseBootstrapCliArgs,
} from "../src/lib/auth/bootstrap-cli";
import { hashPassword } from "../src/lib/auth/password-core";

function printHelp(): void {
  process.stdout.write(`Usage: pnpm staff:bootstrap [options]

Create the first privileged staff account for an empty installation.

Options:
  --email <email>            Staff email. Prompted when omitted.
  --display-name <name>      Staff display name. Prompted when omitted.
  --password-stdin           Read password from stdin instead of hidden prompt.
  --yes, -y                  Confirm non-interactively.
  --help, -h                 Show this help.

Security:
  Passwords are never accepted through --password.
  The command refuses to run when any staff user already exists.
`);
}

async function main(): Promise<void> {
  const options = parseBootstrapCliArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  loadLocalEnv(process.cwd());

  const email = normalizeBootstrapEmail(
    options.email ?? (await promptRequired("Email: ")),
  );
  const displayName = normalizeBootstrapDisplayName(
    options.displayName ?? (await promptRequired("Display name: ")),
  );
  const password = options.passwordStdin
    ? await readPasswordFromStdin()
    : await promptConfirmedPassword();
  assertBootstrapPassword(password);

  const target = describeDatabaseTarget(process.env.DATABASE_URL);
  process.stdout.write(`Database target: ${target.host}/${target.database}\n`);
  process.stdout.write(`Role: ${STAFF_ROLE.SUPER_ADMIN}\n`);
  process.stdout.write(`Scope: ${STAFF_SCOPE_MODE.ALL}\n`);

  if (!options.yes) {
    const accepted = await promptConfirmation(
      `Create the first privileged staff account in database "${target.database}"? [y/N] `,
    );
    if (!accepted) {
      process.stdout.write("Initial staff bootstrap was not performed.\n");
      return;
    }
  }

  const passwordHash = await hashPassword(password);
  const created = await bootstrapInitialStaff({
    email,
    displayName,
    passwordHash,
    role: STAFF_ROLE.SUPER_ADMIN,
    scopeMode: STAFF_SCOPE_MODE.ALL,
  });

  process.stdout.write("Initial staff account created successfully.\n");
  process.stdout.write(`Email: ${created.email}\n`);
  process.stdout.write(`Role: ${created.role}\n`);
  process.stdout.write(`Scope: ${created.scopeMode}\n`);
}

async function promptRequired(label: string): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new BootstrapCliInputError(`${label.trim()} is required.`);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await rl.question(label);
  } finally {
    rl.close();
  }
}

async function promptConfirmedPassword(): Promise<string> {
  const password = await promptHidden("Password: ");
  const confirmation = await promptHidden("Confirm password: ");
  assertPasswordConfirmation(password, confirmation);
  return password;
}

function promptHidden(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new BootstrapCliInputError(
      "Interactive password prompt requires a TTY. Use --password-stdin for non-interactive execution.",
    );
  }

  return new Promise((resolve, reject) => {
    let value = "";
    const input = process.stdin;

    function cleanup(): void {
      input.setRawMode(false);
      input.pause();
      input.off("data", onData);
    }

    function onData(chunk: Buffer | string): void {
      const text = chunk.toString("utf8");
      for (const char of text) {
        if (char === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new BootstrapCliInputError("Password prompt cancelled."));
          return;
        }

        if (char === "\r" || char === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }

        if (char === "\b" || char === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }

        value += char;
      }
    }

    process.stdout.write(label);
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function readPasswordFromStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    throw new BootstrapCliInputError(
      "--password-stdin requires password data on stdin.",
    );
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

async function promptConfirmation(label: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    throw new BootstrapCliInputError(
      "Confirmation requires a TTY. Use --yes for deliberate non-interactive execution.",
    );
  }

  const answer = await promptRequired(label);
  return answer.trim().toLowerCase() === "y";
}

function describeDatabaseTarget(raw: string | undefined): {
  host: string;
  database: string;
} {
  if (!raw) {
    throw new BootstrapCliInputError("DATABASE_URL is required.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BootstrapCliInputError("DATABASE_URL is not a valid URL.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new BootstrapCliInputError(
      "DATABASE_URL must be a postgres:// or postgresql:// URL.",
    );
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, "")).trim();
  if (!database) {
    throw new BootstrapCliInputError("DATABASE_URL must include a database name.");
  }

  return {
    host: url.hostname,
    database,
  };
}

function loadLocalEnv(appRoot: string): void {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(appRoot, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const text = readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) {
        continue;
      }

      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) {
        continue;
      }

      process.env[key] = unquoteEnvValue(rawValue);
    }
  }
}

function unquoteEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof BootstrapCliInputError) {
    return error.message;
  }

  if (error instanceof StaffBootstrapError) {
    if (error.code === STAFF_BOOTSTRAP_ERROR.EXISTING_STAFF) {
      return "Staff users already exist. Initial bootstrap was not performed.";
    }
    return error.message;
  }

  if (error instanceof Error) {
    return redactSecrets(error.message);
  }

  return "Staff bootstrap failed.";
}

function redactSecrets(message: string): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return message;
  }
  return message.split(databaseUrl).join("[redacted DATABASE_URL]");
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${safeErrorMessage(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDb();
  });
