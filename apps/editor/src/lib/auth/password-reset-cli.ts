import { STAFF_ROLE } from "@magazine/domain";
import { BootstrapCliInputError } from "./bootstrap-cli";

export type PasswordResetCliOptions = {
  help: boolean;
};

export function parsePasswordResetCliArgs(
  args: readonly string[],
): PasswordResetCliOptions {
  const options: PasswordResetCliOptions = {
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--password" || arg === "-p" || arg === "--password-stdin") {
      throw new BootstrapCliInputError(
        "Do not pass passwords as command arguments. Use the hidden interactive prompt.",
      );
    }

    if (arg === "--email" || arg === "-e") {
      throw new BootstrapCliInputError(
        "Email must be entered at the interactive prompt.",
      );
    }

    throw new BootstrapCliInputError(`Unknown option: ${arg}`);
  }

  return options;
}

export function buildSuperAdminResetConfirmation(email: string): string {
  return `RESET PASSWORD ${email}`;
}

export function assertSuperAdminResetConfirmation(
  input: string,
  email: string,
): void {
  const expected = buildSuperAdminResetConfirmation(email);
  if (input.trim() !== expected) {
    throw new BootstrapCliInputError(
      `Type exactly: ${expected}`,
    );
  }
}

export function requiresSuperAdminResetConfirmation(
  roles: readonly string[],
): boolean {
  return roles.includes(STAFF_ROLE.SUPER_ADMIN);
}

export function describeSanitizedDatabaseTarget(raw: string | undefined): {
  host: string;
  port: string;
  database: string;
  label: string;
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

  const host = url.hostname;
  const port = url.port || "5432";

  return {
    host,
    port,
    database,
    label: `${host}:${port}/${database}`,
  };
}
