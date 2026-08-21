import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { contentItems } from "./content";

/**
 * Editorially curated “Şu An Konuşuluyor” rail.
 * Not a generic homepage builder and not an analytics ranking table.
 */
export const homepageConversationItems = pgTable(
  "homepage_conversation_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sortOrder: integer("sort_order").notNull(),
    label: text("label").notNull(),
    reason: text("reason"),
    contentItemId: uuid("content_item_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("homepage_conversation_items_sort_order_key").on(table.sortOrder),
    foreignKey({
      name: "homepage_conversation_items_content_item_id_fk",
      columns: [table.contentItemId],
      foreignColumns: [contentItems.id],
    }).onDelete("restrict"),
    check(
      "homepage_conversation_items_sort_order_positive",
      sql`${table.sortOrder} > 0`,
    ),
    check(
      "homepage_conversation_items_label_bounds",
      sql`char_length(${table.label}) BETWEEN 1 AND 80`,
    ),
    check(
      "homepage_conversation_items_reason_bounds",
      sql`${table.reason} IS NULL OR char_length(${table.reason}) BETWEEN 1 AND 200`,
    ),
    index("homepage_conversation_items_public_idx").on(
      table.isActive,
      table.sortOrder,
      table.id,
    ),
  ],
);
