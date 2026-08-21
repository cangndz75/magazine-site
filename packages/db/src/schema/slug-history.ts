import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { contentItems } from "./content";
import { staffUsers } from "./staff";

/**
 * Immutable historical slugs. Current slug remains on content_items.
 * old_slug is globally unique so two items cannot claim the same redirect.
 */
export const contentSlugHistory = pgTable(
  "content_slug_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentItemId: uuid("content_item_id").notNull(),
    oldSlug: text("old_slug").notNull(),
    actorStaffUserId: uuid("actor_staff_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("content_slug_history_old_slug_key").on(table.oldSlug),
    unique("content_slug_history_item_old_slug_key").on(
      table.contentItemId,
      table.oldSlug,
    ),
    foreignKey({
      name: "content_slug_history_item_fk",
      columns: [table.contentItemId],
      foreignColumns: [contentItems.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_slug_history_actor_staff_fk",
      columns: [table.actorStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    index("content_slug_history_item_created_idx").on(
      table.contentItemId,
      table.createdAt,
      table.id,
    ),
    check(
      "content_slug_history_old_slug_format",
      sql`${table.oldSlug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${table.oldSlug}) BETWEEN 1 AND 200`,
    ),
  ],
);
