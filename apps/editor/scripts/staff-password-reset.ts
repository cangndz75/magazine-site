import process from "node:process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { closeDb } from "@magazine/db/client";
import {
  STAFF_PASSWORD_RESET_ERROR,
  StaffPasswordResetError,
  lookupActiveStaffAccountByEmail,
  resetStaffPassword,
} from "@magazine/db/staff-password-reset";
import {
  BootstrapCliInputError,
  assertBootstrapPassword,
  assertPasswordConfirmation,
  normalizeBootstrapEmail,
} from "../src/lib/auth/bootstrap-cli";
import {
  assertSuperAdminResetConfirmation,
  describeSanitizedDatabaseTarget,
  parsePasswordResetCliArgs,
  requiresSuperAdminResetConfirmation,
} from "../src/lib/auth/password-reset-cli";
import { hashPassword } from "../src/lib/auth/password-core";

function printHelp(): void {
  process.stdout.write(`Usage: pnpm staff:password-reset

Reset the password for an existing active staff account.

The command uses DATABASE_URL, prints only host:port/database, prompts for the
staff email, hidden password (twice), and updates the existing credential.

Security:
  Passwords are never accepted through command arguments.
  SUPER_ADMIN accounts require typing exactly: RESET PASSWORD followed by the canonical email.
  MFA factors and recovery codes are not removed.
`);
}

async function main(): Promise<void> {
  const options = parsePasswordResetCliArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  loadLocalEnv(process.cwd());

  const target = describeSanitizedDatabaseTarget(process.env.DATABASE_URL);
  process.stdout.write(`Database target: ${target.label}\n`);

  const email = normalizeBootstrapEmail(await promptRequired("Staff email: "));
  const account = await lookupActiveStaffAccountByEmail(email);
  if (!account) {
    throw new StaffPasswordResetError(
      STAFF_PASSWORD_RESET_ERROR.USER_NOT_FOUND,
      "Staff account was not found.",
    );
  }

  if (requiresSuperAdminResetConfirmation(account.roles)) {
    const confirmation = await promptRequired(
      `Type exactly: RESET PASSWORD ${account.email}\n`,
    );
    assertSuperAdminResetConfirmation(confirmation, account.email);
  }

  const password = await promptConfirmedPassword();
  assertBootstrapPassword(password);

  const passwordHash = await hashPassword(password);
  const result = await resetStaffPassword({
    email: account.email,
    passwordHash,
  });

  process.stdout.write("Staff password reset successfully.\n");
  process.stdout.write(`Email: ${result.email}\n`);
  process.stdout.write(`Revoked sessions: ${result.revokedSessionCount}\n`);
  process.stdout.write(
    `Invalidated login/MFA challenges: ${result.invalidatedChallengeCount}\n`,
  );
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
  const password = await promptHidden("New password: ");
  const confirmation = await promptHidden("Confirm new password: ");
  assertPasswordConfirmation(password, confirmation);
  return password;
}

function promptHidden(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new BootstrapCliInputError(
      "Interactive password prompt requires a TTY.",
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

  if (error instanceof StaffPasswordResetError) {
    return error.message;
  }

  if (error instanceof Error) {
    return redactSecrets(error.message);
  }

  return "Staff password reset failed.";
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
