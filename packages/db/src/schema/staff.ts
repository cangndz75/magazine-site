import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { staffRoleEnum, staffScopeModeEnum, staffStatusEnum } from "./enums";
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
