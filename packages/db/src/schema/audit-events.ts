import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  type ContentAuditActorKind,
  type ContentAuditChangeSet,
  type ContentAuditEventType,
} from "@magazine/domain";
import { contentItems, contentVersions } from "./content";
import { staffUsers } from "./staff";

/**
 * Append-only content mutation audit events.
 * Application code must only INSERT. There is no update/delete API.
 */
export const contentAuditEvents = pgTable(
  "content_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentItemId: uuid("content_item_id").notNull(),
    contentVersionId: uuid("content_version_id"),
    eventType: text("event_type")
      .$type<ContentAuditEventType>()
      .notNull(),
    actorKind: text("actor_kind")
      .$type<ContentAuditActorKind>()
      .notNull(),
    actorStaffUserId: uuid("actor_staff_user_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    changeSet: jsonb("change_set").$type<ContentAuditChangeSet | null>(),
  },
  (table) => [
    foreignKey({
      name: "content_audit_events_item_fk",
      columns: [table.contentItemId],
      foreignColumns: [contentItems.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_audit_events_version_fk",
      columns: [table.contentItemId, table.contentVersionId],
      foreignColumns: [contentVersions.contentItemId, contentVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_audit_events_actor_staff_fk",
      columns: [table.actorStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    index("content_audit_events_item_occurred_idx").on(
      table.contentItemId,
      table.occurredAt,
      table.id,
    ),
    index("content_audit_events_version_idx").on(table.contentVersionId),
    check(
      "content_audit_events_type_check",
      sql`${table.eventType} IN (
        'CONTENT_CREATED',
        'DRAFT_REVISION_CREATED',
        'DRAFT_UPDATED',
        'REVIEW_SUBMITTED',
        'REVIEW_CHANGES_REQUESTED',
        'REVIEW_APPROVED',
        'CONTENT_PUBLISHED',
        'CONTENT_UNPUBLISHED',
        'CONTENT_SCHEDULED',
        'CONTENT_RESCHEDULED',
        'CONTENT_SCHEDULE_CANCELLED'
      )`,
    ),
    check(
      "content_audit_events_actor_kind_check",
      sql`${table.actorKind} IN ('STAFF', 'SYSTEM')`,
    ),
    check(
      "content_audit_events_actor_staff_required",
      sql`(
        (${table.actorKind} = 'STAFF' AND ${table.actorStaffUserId} IS NOT NULL)
        OR
        (${table.actorKind} = 'SYSTEM' AND ${table.actorStaffUserId} IS NULL)
      )`,
    ),
  ],
);
