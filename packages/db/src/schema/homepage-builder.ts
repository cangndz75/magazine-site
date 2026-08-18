import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  type HomepageAuditChangeSet,
  type HomepageAuditEventType,
  type HomepageSlotKey,
} from "@magazine/domain";
import { contentItems } from "./content";
import { staffUsers } from "./staff";

export const homepageVersions = pgTable(
  "homepage_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    homepageId: uuid("homepage_id")
      .notNull()
      .references((): AnyPgColumn => homepages.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdByStaffUserId: uuid("created_by_staff_user_id").references(
      (): AnyPgColumn => staffUsers.id,
      { onDelete: "restrict" },
    ),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    index("homepage_versions_homepage_idx").on(table.homepageId, table.createdAt),
  ],
);

export const homepages = pgTable(
  "homepages",
  {
    id: uuid("id").primaryKey(),
    publishedVersionId: uuid("published_version_id"),
    draftVersionId: uuid("draft_version_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "homepages_singleton_id",
      sql`${table.id} = '00000000-0000-4000-8000-000000000001'::uuid`,
    ),
    foreignKey({
      name: "homepages_published_version_fk",
      columns: [table.publishedVersionId],
      foreignColumns: [homepageVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "homepages_draft_version_fk",
      columns: [table.draftVersionId],
      foreignColumns: [homepageVersions.id],
    }).onDelete("restrict"),
    check(
      "homepages_published_draft_distinct",
      sql`${table.publishedVersionId} IS NULL
        OR ${table.draftVersionId} IS NULL
        OR ${table.publishedVersionId} IS DISTINCT FROM ${table.draftVersionId}`,
    ),
  ],
);

export const homepageSlots = pgTable(
  "homepage_slots",
  {
    homepageVersionId: uuid("homepage_version_id").notNull(),
    slotKey: text("slot_key").$type<HomepageSlotKey>().notNull(),
    contentItemId: uuid("content_item_id"),
  },
  (table) => [
    primaryKey({
      name: "homepage_slots_pk",
      columns: [table.homepageVersionId, table.slotKey],
    }),
    foreignKey({
      name: "homepage_slots_version_fk",
      columns: [table.homepageVersionId],
      foreignColumns: [homepageVersions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "homepage_slots_content_item_fk",
      columns: [table.contentItemId],
      foreignColumns: [contentItems.id],
    }).onDelete("restrict"),
    check(
      "homepage_slots_slot_key_check",
      sql`${table.slotKey} IN (
        'LEAD',
        'SUPPORT_1',
        'SUPPORT_2',
        'FEATURED_1',
        'FEATURED_2',
        'FEATURED_3',
        'FEATURED_4',
        'FEATURED_5'
      )`,
    ),
    index("homepage_slots_version_idx").on(table.homepageVersionId),
    index("homepage_slots_content_item_idx").on(table.contentItemId),
    uniqueIndex("homepage_slots_unique_content_item")
      .on(table.homepageVersionId, table.contentItemId)
      .where(sql`${table.contentItemId} IS NOT NULL`),
  ],
);

export const homepageAuditEvents = pgTable(
  "homepage_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    homepageVersionId: uuid("homepage_version_id"),
    eventType: text("event_type").$type<HomepageAuditEventType>().notNull(),
    actorKind: text("actor_kind").notNull(),
    actorStaffUserId: uuid("actor_staff_user_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    changeSet: jsonb("change_set").$type<HomepageAuditChangeSet | null>(),
  },
  (table) => [
    foreignKey({
      name: "homepage_audit_events_version_fk",
      columns: [table.homepageVersionId],
      foreignColumns: [homepageVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "homepage_audit_events_actor_staff_fk",
      columns: [table.actorStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    index("homepage_audit_events_occurred_idx").on(table.occurredAt, table.id),
    check(
      "homepage_audit_events_type_check",
      sql`${table.eventType} IN ('HOMEPAGE_DRAFT_UPDATED', 'HOMEPAGE_PUBLISHED')`,
    ),
    check(
      "homepage_audit_events_actor_kind_check",
      sql`${table.actorKind} IN ('STAFF', 'SYSTEM')`,
    ),
    check(
      "homepage_audit_events_actor_staff_required",
      sql`(
        (${table.actorKind} = 'STAFF' AND ${table.actorStaffUserId} IS NOT NULL)
        OR
        (${table.actorKind} = 'SYSTEM' AND ${table.actorStaffUserId} IS NULL)
      )`,
    ),
  ],
);
