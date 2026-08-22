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
  uuid,
} from "drizzle-orm/pg-core";
import { staffUsers } from "./staff";

export const featureControls = pgTable(
  "feature_controls",
  {
    key: text("key").primaryKey(),
    type: text("type").notNull(),
    enabled: boolean("enabled").notNull(),
    description: text("description").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedByStaffUserId: uuid("updated_by_staff_user_id"),
  },
  (table) => [
    foreignKey({
      name: "feature_controls_updated_by_staff_user_id_fk",
      columns: [table.updatedByStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    check(
      "feature_controls_type_check",
      sql`${table.type} IN ('FEATURE_FLAG', 'KILL_SWITCH')`,
    ),
    check(
      "feature_controls_key_check",
      sql`${table.key} IN ('PUBLIC_SEARCH', 'PUBLIC_GALLERIES', 'EDITORIAL_CALENDAR', 'ANALYTICS_INGESTION', 'SCHEDULED_PUBLISHING', 'PUBLIC_VIDEO', 'HOMEPAGE_CONVERSATION')`,
    ),
    check(
      "feature_controls_description_length",
      sql`char_length(${table.description}) BETWEEN 1 AND 500`,
    ),
  ],
);

export const featureControlAuditEvents = pgTable(
  "feature_control_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    controlKey: text("control_key").notNull(),
    controlType: text("control_type").notNull(),
    actorStaffUserId: uuid("actor_staff_user_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    oldEnabled: boolean("old_enabled").notNull(),
    newEnabled: boolean("new_enabled").notNull(),
    oldDescription: text("old_description").notNull(),
    newDescription: text("new_description").notNull(),
    changeSet: jsonb("change_set").notNull(),
  },
  (table) => [
    index("feature_control_audit_events_control_key_idx").on(
      table.controlKey,
      table.occurredAt,
    ),
    foreignKey({
      name: "feature_control_audit_events_control_key_fk",
      columns: [table.controlKey],
      foreignColumns: [featureControls.key],
    }).onDelete("restrict"),
    foreignKey({
      name: "feature_control_audit_events_actor_staff_user_id_fk",
      columns: [table.actorStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    check(
      "feature_control_audit_events_type_check",
      sql`${table.controlType} IN ('FEATURE_FLAG', 'KILL_SWITCH')`,
    ),
    check(
      "feature_control_audit_events_key_check",
      sql`${table.controlKey} IN ('PUBLIC_SEARCH', 'PUBLIC_GALLERIES', 'EDITORIAL_CALENDAR', 'ANALYTICS_INGESTION', 'SCHEDULED_PUBLISHING', 'PUBLIC_VIDEO', 'HOMEPAGE_CONVERSATION')`,
    ),
  ],
);
