import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { entityKindEnum, entityStatusEnum } from "./enums";
import { media } from "./media";
import { staffUsers } from "./staff";

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: entityKindEnum("kind").notNull(),
    status: entityStatusEnum("status").notNull().default("ACTIVE"),
    canonicalName: text("canonical_name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    biography: text("biography"),
    portraitMediaId: uuid("portrait_media_id"),
    birthDate: date("birth_date", { mode: "string" }),
    occupation: text("occupation"),
    officialWebsiteUrl: text("official_website_url"),
    mergedIntoEntityId: uuid("merged_into_entity_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
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
    index("entities_status_kind_idx").on(table.status, table.kind),
    index("entities_status_updated_idx").on(
      table.status,
      table.updatedAt,
      table.id,
    ),
    foreignKey({
      name: "entities_portrait_media_fk",
      columns: [table.portraitMediaId],
      foreignColumns: [media.id],
    }).onDelete("set null"),
    foreignKey({
      name: "entities_merged_into_entity_fk",
      columns: [table.mergedIntoEntityId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    check(
      "entities_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${table.slug}) BETWEEN 1 AND 200`,
    ),
    check(
      "entities_canonical_name_length",
      sql`char_length(${table.canonicalName}) BETWEEN 1 AND 200`,
    ),
    check(
      "entities_summary_length",
      sql`${table.description} IS NULL OR char_length(${table.description}) BETWEEN 1 AND 500`,
    ),
    check(
      "entities_biography_length",
      sql`${table.biography} IS NULL OR char_length(${table.biography}) BETWEEN 1 AND 4000`,
    ),
    check(
      "entities_occupation_length",
      sql`${table.occupation} IS NULL OR char_length(${table.occupation}) BETWEEN 1 AND 200`,
    ),
    check(
      "entities_person_only_profile_fields",
      sql`${table.kind} = 'PERSON' OR (${table.birthDate} IS NULL AND ${table.occupation} IS NULL)`,
    ),
    check(
      "entities_merged_into_not_self",
      sql`${table.mergedIntoEntityId} IS NULL OR ${table.mergedIntoEntityId} <> ${table.id}`,
    ),
    check(
      "entities_status_matches_is_active",
      sql`(${table.isActive} AND ${table.status} = 'ACTIVE') OR (NOT ${table.isActive} AND ${table.status} <> 'ACTIVE')`,
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
    index("entity_aliases_normalized_alias_idx").on(table.normalizedAlias),
    foreignKey({
      name: "entity_aliases_entity_id_fk",
      columns: [table.entityId],
      foreignColumns: [entities.id],
    }).onDelete("cascade"),
    check(
      "entity_aliases_alias_length",
      sql`char_length(${table.alias}) BETWEEN 1 AND 200`,
    ),
    check(
      "entity_aliases_normalized_alias_format",
      sql`${table.normalizedAlias} = lower(${table.normalizedAlias}) AND char_length(${table.normalizedAlias}) BETWEEN 1 AND 200`,
    ),
  ],
);

export const entitySlugHistory = pgTable(
  "entity_slug_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").notNull(),
    oldSlug: text("old_slug").notNull(),
    actorStaffUserId: uuid("actor_staff_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("entity_slug_history_old_slug_key").on(table.oldSlug),
    unique("entity_slug_history_entity_old_slug_key").on(
      table.entityId,
      table.oldSlug,
    ),
    foreignKey({
      name: "entity_slug_history_entity_fk",
      columns: [table.entityId],
      foreignColumns: [entities.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "entity_slug_history_actor_staff_fk",
      columns: [table.actorStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    index("entity_slug_history_entity_created_idx").on(
      table.entityId,
      table.createdAt,
      table.id,
    ),
    check(
      "entity_slug_history_old_slug_format",
      sql`${table.oldSlug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${table.oldSlug}) BETWEEN 1 AND 200`,
    ),
  ],
);

export const entityAuditEvents = pgTable(
  "entity_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityId: uuid("entity_id").notNull(),
    eventType: text("event_type").notNull(),
    actorKind: text("actor_kind").notNull(),
    actorStaffUserId: uuid("actor_staff_user_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    changeSet: jsonb("change_set"),
  },
  (table) => [
    foreignKey({
      name: "entity_audit_events_entity_fk",
      columns: [table.entityId],
      foreignColumns: [entities.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "entity_audit_events_actor_staff_fk",
      columns: [table.actorStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    index("entity_audit_events_entity_occurred_idx").on(
      table.entityId,
      table.occurredAt,
      table.id,
    ),
    check(
      "entity_audit_events_type_check",
      sql`${table.eventType} IN (
        'ENTITY_CREATED',
        'ENTITY_UPDATED',
        'ENTITY_SLUG_CHANGED',
        'ENTITY_ARCHIVED',
        'ENTITY_REACTIVATED'
      )`,
    ),
    check(
      "entity_audit_events_actor_kind_check",
      sql`${table.actorKind} IN ('STAFF', 'SYSTEM')`,
    ),
    check(
      "entity_audit_events_actor_staff_required",
      sql`(
        (${table.actorKind} = 'STAFF' AND ${table.actorStaffUserId} IS NOT NULL)
        OR
        (${table.actorKind} = 'SYSTEM' AND ${table.actorStaffUserId} IS NULL)
      )`,
    ),
  ],
);
