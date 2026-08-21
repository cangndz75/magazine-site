import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const authors = pgTable(
  "authors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    slug: text("slug").notNull(),
    bio: text("bio"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("authors_slug_key").on(table.slug),
    check(
      "authors_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${table.slug}) BETWEEN 1 AND 200`,
    ),
  ],
);
