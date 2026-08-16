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
import { entityKindEnum } from "./enums";

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: entityKindEnum("kind").notNull(),
    canonicalName: text("canonical_name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("entities_slug_key").on(table.slug),
    check(
      "entities_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${table.slug}) BETWEEN 1 AND 200`,
    ),
  ],
);

export const entityAliases = pgTable(
  "entity_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").notNull(),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("entity_aliases_entity_normalized_key").on(
      table.entityId,
      table.normalizedAlias,
    ),
    foreignKey({
      name: "entity_aliases_entity_id_fk",
      columns: [table.entityId],
      foreignColumns: [entities.id],
    }).onDelete("cascade"),
    check(
      "entity_aliases_normalized_alias_format",
      sql`${table.normalizedAlias} = lower(${table.normalizedAlias}) AND char_length(${table.normalizedAlias}) BETWEEN 1 AND 200`,
    ),
  ],
);
