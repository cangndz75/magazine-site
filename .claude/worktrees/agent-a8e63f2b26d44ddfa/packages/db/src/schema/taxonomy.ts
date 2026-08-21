import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: uuid("parent_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("categories_slug_key").on(table.slug),
    foreignKey({
      name: "categories_parent_id_fk",
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    check("categories_parent_not_self", sql`${table.parentId} IS DISTINCT FROM ${table.id}`),
    check(
      "categories_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${table.slug}) BETWEEN 1 AND 200`,
    ),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("tags_slug_key").on(table.slug),
    check(
      "tags_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${table.slug}) BETWEEN 1 AND 200`,
    ),
  ],
);
