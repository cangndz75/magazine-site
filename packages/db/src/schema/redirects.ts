import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { staffUsers } from "./staff";

export const redirectRules = pgTable(
  "redirect_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourcePath: text("source_path").notNull(),
    targetPath: text("target_path").notNull(),
    status: text("status").notNull().default("PERMANENT"),
    enabled: boolean("enabled").notNull().default(true),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdByStaffUserId: uuid("created_by_staff_user_id").notNull(),
    updatedByStaffUserId: uuid("updated_by_staff_user_id").notNull(),
  },
  (table) => [
    unique("redirect_rules_source_path_key").on(table.sourcePath),
    index("redirect_rules_enabled_source_path_idx").on(
      table.enabled,
      table.sourcePath,
    ),
    foreignKey({
      name: "redirect_rules_created_by_staff_user_id_fk",
      columns: [table.createdByStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "redirect_rules_updated_by_staff_user_id_fk",
      columns: [table.updatedByStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    check("redirect_rules_status_check", sql`${table.status} = 'PERMANENT'`),
    check(
      "redirect_rules_source_target_distinct",
      sql`${table.sourcePath} <> ${table.targetPath}`,
    ),
    check(
      "redirect_rules_note_length",
      sql`${table.note} IS NULL OR char_length(${table.note}) BETWEEN 1 AND 500`,
    ),
  ],
);

export const redirectRuleAuditEvents = pgTable(
  "redirect_rule_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    redirectRuleId: uuid("redirect_rule_id").notNull(),
    actorStaffUserId: uuid("actor_staff_user_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sourcePath: text("source_path").notNull(),
    oldTargetPath: text("old_target_path"),
    newTargetPath: text("new_target_path"),
    oldEnabled: boolean("old_enabled"),
    newEnabled: boolean("new_enabled"),
    changeSet: jsonb("change_set").notNull(),
  },
  (table) => [
    index("redirect_rule_audit_events_rule_occurred_idx").on(
      table.redirectRuleId,
      table.occurredAt,
    ),
    foreignKey({
      name: "redirect_rule_audit_events_redirect_rule_id_fk",
      columns: [table.redirectRuleId],
      foreignColumns: [redirectRules.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "redirect_rule_audit_events_actor_staff_user_id_fk",
      columns: [table.actorStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
  ],
);
