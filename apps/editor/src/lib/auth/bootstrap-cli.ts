import {
  PASSWORD_POLICY_ISSUE,
  STAFF_EMAIL_MAX_LENGTH,
  STAFF_ROLES,
  assertPasswordPolicy,
  normalizeStaffEmail,
  type StaffRole,
} from "@magazine/domain";

export type BootstrapCliOptions = {
  email: string | null;
  displayName: string | null;
  passwordStdin: boolean;
  yes: boolean;
  help: boolean;
};

export class BootstrapCliInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapCliInputError";
  }
}

export function parseBootstrapCliArgs(args: readonly string[]): BootstrapCliOptions {
  const options: BootstrapCliOptions = {
    email: null,
    displayName: null,
    passwordStdin: false,
    yes: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--yes" || arg === "-y") {
      options.yes = true;
      continue;
    }

    if (arg === "--password-stdin") {
      options.passwordStdin = true;
      continue;
    }

    if (arg === "--email") {
      options.email = requireOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--display-name") {
      options.displayName = requireOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--password" || arg === "-p") {
      throw new BootstrapCliInputError(
        "Do not pass passwords as command arguments. Use the hidden prompt or --password-stdin.",
      );
    }

    throw new BootstrapCliInputError(`Unknown option: ${arg}`);
  }

  return options;
}

function requireOptionValue(
  args: readonly string[],
  index: number,
  option: string,
): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new BootstrapCliInputError(`${option} requires a value.`);
  }
  return value;
}

export function normalizeBootstrapEmail(input: string): string {
  const email = normalizeStaffEmail(input);
  if (email.length < 3 || email.length > STAFF_EMAIL_MAX_LENGTH) {
    throw new BootstrapCliInputError("Email must be 3 to 254 characters.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BootstrapCliInputError("Email must be a valid address.");
  }

  return email;
}

export function normalizeBootstrapDisplayName(input: string): string {
  const displayName = input.trim();
  if (displayName.length < 1 || displayName.length > 200) {
    throw new BootstrapCliInputError(
      "Display name must be 1 to 200 characters.",
    );
  }
  return displayName;
}

export function assertBootstrapPassword(password: string): void {
  const result = assertPasswordPolicy(password);
  if (result.ok) {
    return;
  }

  if (result.issue === PASSWORD_POLICY_ISSUE.TOO_SHORT) {
    throw new BootstrapCliInputError("Password must be at least 12 characters.");
  }

  throw new BootstrapCliInputError("Password must be at most 128 characters.");
}

export function assertPasswordConfirmation(
  password: string,
  confirmation: string,
): void {
  if (password !== confirmation) {
    throw new BootstrapCliInputError("Password confirmation does not match.");
  }
}

export function parseBootstrapRole(input: string): StaffRole {
  if (STAFF_ROLES.includes(input as StaffRole)) {
    return input as StaffRole;
  }
  throw new BootstrapCliInputError(`Unknown staff role: ${input}`);
}
