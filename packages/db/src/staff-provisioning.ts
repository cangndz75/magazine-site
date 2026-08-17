import { count, sql } from "drizzle-orm";
import {
  STAFF_ROLE,
  STAFF_ROLES,
  STAFF_SCOPE_MODE,
  STAFF_SCOPE_MODES,
  STAFF_STATUS,
  normalizeStaffEmail,
  type StaffRole,
  type StaffScopeMode,
} from "@magazine/domain";
import { getDb } from "./client";
import {
  staffPasswordCredentials,
  staffUserRoles,
  staffUsers,
} from "./schema";

export const STAFF_BOOTSTRAP_ERROR = {
  EXISTING_STAFF: "EXISTING_STAFF",
  INVALID_EMAIL: "INVALID_EMAIL",
  INVALID_DISPLAY_NAME: "INVALID_DISPLAY_NAME",
  INVALID_PASSWORD_HASH: "INVALID_PASSWORD_HASH",
  INVALID_ROLE: "INVALID_ROLE",
  INVALID_SCOPE: "INVALID_SCOPE",
} as const;

export type StaffBootstrapErrorCode =
  (typeof STAFF_BOOTSTRAP_ERROR)[keyof typeof STAFF_BOOTSTRAP_ERROR];

export class StaffBootstrapError extends Error {
  constructor(readonly code: StaffBootstrapErrorCode, message: string) {
    super(message);
    this.name = "StaffBootstrapError";
  }
}

export type BootstrapInitialStaffInput = {
  email: string;
  displayName: string;
  passwordHash: string;
  role?: string;
  scopeMode?: string;
};

export type BootstrapInitialStaffResult = {
  staffUserId: string;
  email: string;
  displayName: string;
  role: StaffRole;
  scopeMode: StaffScopeMode;
};

const BOOTSTRAP_LOCK_NAMESPACE = 761_244_001;
const BOOTSTRAP_LOCK_KEY = 1;

export async function bootstrapInitialStaff(
  input: BootstrapInitialStaffInput,
): Promise<BootstrapInitialStaffResult> {
  const email = normalizeProvisioningEmail(input.email);
  const displayName = normalizeProvisioningDisplayName(input.displayName);
  const passwordHash = normalizeProvisioningPasswordHash(input.passwordHash);
  const role = normalizeProvisioningRole(input.role ?? STAFF_ROLE.SUPER_ADMIN);
  const scopeMode = normalizeProvisioningScopeMode(
    input.scopeMode ?? STAFF_SCOPE_MODE.ALL,
  );

  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_NAMESPACE}, ${BOOTSTRAP_LOCK_KEY})`,
    );

    const [existing] = await tx.select({ value: count() }).from(staffUsers);
    if ((existing?.value ?? 0) > 0) {
      throw new StaffBootstrapError(
        STAFF_BOOTSTRAP_ERROR.EXISTING_STAFF,
        "Staff users already exist. Initial bootstrap was not performed.",
      );
    }

    const now = new Date();
    const [user] = await tx
      .insert(staffUsers)
      .values({
        email,
        displayName,
        status: STAFF_STATUS.ACTIVE,
        scopeMode,
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: staffUsers.id,
        email: staffUsers.email,
        displayName: staffUsers.displayName,
        scopeMode: staffUsers.scopeMode,
      });

    if (!user) {
      throw new Error("Failed to create staff user.");
    }

    await tx.insert(staffPasswordCredentials).values({
      staffUserId: user.id,
      passwordHash,
      passwordChangedAt: now,
    });

    await tx.insert(staffUserRoles).values({
      staffUserId: user.id,
      role,
    });

    return {
      staffUserId: user.id,
      email: user.email,
      displayName: user.displayName,
      role,
      scopeMode: user.scopeMode,
    };
  });
}

function normalizeProvisioningEmail(input: string): string {
  const email = normalizeStaffEmail(input);
  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new StaffBootstrapError(
      STAFF_BOOTSTRAP_ERROR.INVALID_EMAIL,
      "Email must be a valid canonical address.",
    );
  }
  return email;
}

function normalizeProvisioningDisplayName(input: string): string {
  const displayName = input.trim();
  if (displayName.length < 1 || displayName.length > 200) {
    throw new StaffBootstrapError(
      STAFF_BOOTSTRAP_ERROR.INVALID_DISPLAY_NAME,
      "Display name must be 1 to 200 characters.",
    );
  }
  return displayName;
}

function normalizeProvisioningPasswordHash(input: string): string {
  const passwordHash = input.trim();
  if (!passwordHash.startsWith("$argon2id$")) {
    throw new StaffBootstrapError(
      STAFF_BOOTSTRAP_ERROR.INVALID_PASSWORD_HASH,
      "Password hash is not a supported Argon2id hash.",
    );
  }
  return passwordHash;
}

function normalizeProvisioningRole(input: string): StaffRole {
  if (STAFF_ROLES.includes(input as StaffRole)) {
    return input as StaffRole;
  }
  throw new StaffBootstrapError(
    STAFF_BOOTSTRAP_ERROR.INVALID_ROLE,
    "Staff role is not supported.",
  );
}

function normalizeProvisioningScopeMode(input: string): StaffScopeMode {
  if (STAFF_SCOPE_MODES.includes(input as StaffScopeMode)) {
    return input as StaffScopeMode;
  }
  throw new StaffBootstrapError(
    STAFF_BOOTSTRAP_ERROR.INVALID_SCOPE,
    "Staff scope mode is not supported.",
  );
}
