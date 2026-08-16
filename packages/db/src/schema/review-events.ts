import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { contentItems, contentVersions } from "./content";
import { reviewEventTypeEnum } from "./enums";
import { staffUsers } from "./staff";

/**
 * Append-only editorial review lifecycle events.
 * Application code must only INSERT. There is no update/delete API.
 */
export const contentReviewEvents = pgTable(
  "content_review_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentItemId: uuid("content_item_id").notNull(),
    contentVersionId: uuid("content_version_id").notNull(),
    eventType: reviewEventTypeEnum("event_type").notNull(),
    actorId: uuid("actor_id").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "content_review_events_item_fk",
      columns: [table.contentItemId],
      foreignColumns: [contentItems.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_review_events_version_fk",
      columns: [table.contentItemId, table.contentVersionId],
      foreignColumns: [contentVersions.contentItemId, contentVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_review_events_actor_fk",
      columns: [table.actorId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    index("content_review_events_version_type_created_idx").on(
      table.contentVersionId,
      table.eventType,
      table.createdAt,
    ),
    index("content_review_events_item_created_idx").on(
      table.contentItemId,
      table.createdAt,
    ),
    check(
      "content_review_events_note_bounds",
      sql`(
        (${table.eventType} = 'CHANGES_REQUESTED' AND ${table.note} IS NOT NULL
          AND char_length(${table.note}) BETWEEN 3 AND 4000)
        OR
        (${table.eventType} <> 'CHANGES_REQUESTED' AND (
          ${table.note} IS NULL
          OR char_length(${table.note}) BETWEEN 3 AND 4000
        ))
      )`,
    ),
  ],
);
