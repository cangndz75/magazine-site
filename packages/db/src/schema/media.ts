import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { mediaTypeEnum } from "./enums";

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storageKey: text("storage_key").notNull(),
    mediaType: mediaTypeEnum("media_type").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    byteSize: integer("byte_size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("media_storage_key_key").on(table.storageKey),
    check("media_byte_size_non_negative", sql`${table.byteSize} >= 0`),
    check("media_width_positive", sql`${table.width} IS NULL OR ${table.width} > 0`),
    check(
      "media_height_positive",
      sql`${table.height} IS NULL OR ${table.height} > 0`,
    ),
  ],
);
