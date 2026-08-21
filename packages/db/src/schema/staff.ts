import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { staffMfaFactorKindEnum, staffMfaFactorStatusEnum, staffRoleEnum, staffScopeModeEnum, staffStatusEnum } from "./enums";
import { categories } from "./taxonomy";

export const staffUsers = pgTable(
  "staff_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    status: staffStatusEnum("status").notNull().default("ACTIVE"),
    scopeMode: staffScopeModeEnum("scope_mode").notNull().default("ALL"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    passwordResetRequiredAt: timestamp("password_reset_required_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    unique("staff_users_email_key").on(table.email),
    check(
      "staff_users_email_canonical",
      sql`${table.email} = lower(${table.email}) AND ${table.email} = btrim(${table.email}) AND char_length(${table.email}) BETWEEN 3 AND 254`,
    ),
    check(
      "staff_users_display_name_length",
      sql`char_length(${table.displayName}) BETWEEN 1 AND 200`,
    ),
  ],
);

export const staffPasswordCredentials = pgTable(
  "staff_password_credentials",
  {
    staffUserId: uuid("staff_user_id").primaryKey(),
    passwordHash: text("password_hash").notNull(),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lastFailedLoginAt: timestamp("last_failed_login_at", {
      withTimezone: true,
    }),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      name: "staff_password_credentials_staff_user_id_fk",
      columns: [table.staffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    check(
      "staff_password_credentials_failed_login_count_non_negative",
      sql`${table.failedLoginCount} >= 0`,
    ),
  ],
);

export const staffUserRoles = pgTable(
  "staff_user_roles",
  {
    staffUserId: uuid("staff_user_id").notNull(),
    role: staffRoleEnum("role").notNull(),
  },
  (table) => [
    primaryKey({
      name: "staff_user_roles_pk",
      columns: [table.staffUserId, table.role],
    }),
    foreignKey({
      name: "staff_user_roles_staff_user_id_fk",
      columns: [table.staffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("cascade"),
  ],
);

export const staffUserCategoryScopes = pgTable(
  "staff_user_category_scopes",
  {
    staffUserId: uuid("staff_user_id").notNull(),
    categoryId: uuid("category_id").notNull(),
  },
  (table) => [
    primaryKey({
      name: "staff_user_category_scopes_pk",
      columns: [table.staffUserId, table.categoryId],
    }),
    foreignKey({
      name: "staff_user_category_scopes_staff_user_id_fk",
      columns: [table.staffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "staff_user_category_scopes_category_id_fk",
      columns: [table.categoryId],
      foreignColumns: [categories.id],
    }).onDelete("restrict"),
  ],
);

export const staffSessions = pgTable(
  "staff_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffUserId: uuid("staff_user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    unique("staff_sessions_token_hash_key").on(table.tokenHash),
    index("staff_sessions_staff_user_id_idx").on(table.staffUserId),
    index("staff_sessions_expires_at_idx").on(table.expiresAt),
    foreignKey({
      name: "staff_sessions_staff_user_id_fk",
      columns: [table.staffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    check(
      "staff_sessions_expires_after_created",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export const staffMfaFactors = pgTable(
  "staff_mfa_factors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffUserId: uuid("staff_user_id").notNull(),
    kind: staffMfaFactorKindEnum("kind").notNull(),
    status: staffMfaFactorStatusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
  },
  (table) => [
    unique("staff_mfa_factors_staff_user_id_key").on(table.staffUserId),
    foreignKey({
      name: "staff_mfa_factors_staff_user_id_fk",
      columns: [table.staffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    check(
      "staff_mfa_factors_active_confirmed",
      sql`(
        ${table.status} <> 'ACTIVE'
        OR ${table.confirmedAt} IS NOT NULL
      )`,
    ),
    check(
      "staff_mfa_factors_disabled_at",
      sql`(
        (${table.status} = 'DISABLED' AND ${table.disabledAt} IS NOT NULL)
        OR
        (${table.status} <> 'DISABLED' AND ${table.disabledAt} IS NULL)
      )`,
    ),
  ],
);

/**
 * MFA secret material. Never selected by staff-admin projections.
 * Super Admin inspects status via staff_mfa_factors only.
 */
export const staffMfaSecrets = pgTable(
  "staff_mfa_secrets",
  {
    factorId: uuid("factor_id").primaryKey(),
    secretCiphertext: text("secret_ciphertext").notNull(),
    lastVerifiedTotpStep: integer("last_verified_totp_step"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "staff_mfa_secrets_factor_id_fk",
      columns: [table.factorId],
      foreignColumns: [staffMfaFactors.id],
    }).onDelete("cascade"),
    check(
      "staff_mfa_secrets_ciphertext_present",
      sql`char_length(${table.secretCiphertext}) BETWEEN 1 AND 4096`,
    ),
  ],
);

export const staffMfaRecoveryCodes = pgTable(
  "staff_mfa_recovery_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    factorId: uuid("factor_id").notNull(),
    codeHash: text("code_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [
    unique("staff_mfa_recovery_codes_code_hash_key").on(table.codeHash),
    index("staff_mfa_recovery_codes_factor_id_idx").on(table.factorId),
    foreignKey({
      name: "staff_mfa_recovery_codes_factor_id_fk",
      columns: [table.factorId],
      foreignColumns: [staffMfaFactors.id],
    }).onDelete("cascade"),
    check(
      "staff_mfa_recovery_codes_hash_present",
      sql`char_length(${table.codeHash}) BETWEEN 16 AND 255`,
    ),
  ],
);

export const staffLoginChallenges = pgTable(
  "staff_login_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffUserId: uuid("staff_user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    failedAttemptCount: integer("failed_attempt_count").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
  },
  (table) => [
    unique("staff_login_challenges_token_hash_key").on(table.tokenHash),
    index("staff_login_challenges_staff_user_id_idx").on(table.staffUserId),
    index("staff_login_challenges_expires_at_idx").on(table.expiresAt),
    foreignKey({
      name: "staff_login_challenges_staff_user_id_fk",
      columns: [table.staffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    check(
      "staff_login_challenges_expires_after_created",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "staff_login_challenges_failed_attempt_count_non_negative",
      sql`${table.failedAttemptCount} >= 0`,
    ),
  ],
);

export const staffSecurityAuditEvents = pgTable(
  "staff_security_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectStaffUserId: uuid("subject_staff_user_id").notNull(),
    eventType: text("event_type").notNull(),
    actorKind: text("actor_kind").notNull(),
    actorStaffUserId: uuid("actor_staff_user_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    changeSet: jsonb("change_set"),
  },
  (table) => [
    foreignKey({
      name: "staff_security_audit_events_subject_fk",
      columns: [table.subjectStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "staff_security_audit_events_actor_staff_fk",
      columns: [table.actorStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    index("staff_security_audit_events_subject_occurred_idx").on(
      table.subjectStaffUserId,
      table.occurredAt,
      table.id,
    ),
    check(
      "staff_security_audit_events_type_check",
      sql`${table.eventType} IN (
        'STAFF_SUSPENDED',
        'STAFF_REACTIVATED',
        'STAFF_ROLE_CHANGED',
        'STAFF_SCOPE_CHANGED',
        'STAFF_SESSION_REVOKED',
        'STAFF_SESSIONS_REVOKED_ALL',
        'STAFF_MFA_DISABLED',
        'STAFF_PASSWORD_RESET_REQUIRED',
        'MFA_ENROLLMENT_STARTED',
        'MFA_ENABLED',
        'MFA_RECOVERY_CODES_REGENERATED',
        'MFA_RECOVERY_CODE_USED',
        'MFA_LOGIN_SUCCEEDED',
        'MFA_CHALLENGE_LOCKED'
      )`,
    ),
    check(
      "staff_security_audit_events_actor_kind_check",
      sql`${table.actorKind} IN ('STAFF', 'SYSTEM')`,
    ),
    check(
      "staff_security_audit_events_actor_staff_required",
      sql`(
        (${table.actorKind} = 'STAFF' AND ${table.actorStaffUserId} IS NOT NULL)
        OR
        (${table.actorKind} = 'SYSTEM' AND ${table.actorStaffUserId} IS NULL)
      )`,
    ),
  ],
);
