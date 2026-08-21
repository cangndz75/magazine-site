import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { authors } from "./authors";
import { entities } from "./entities";
import {
  authorRoleEnum,
  contentLegalActionPolarityEnum,
  contentLegalActionTypeEnum,
  contentLegalReasonCategoryEnum,
  credibilityEnum,
  entityRoleEnum,
  mediaRoleEnum,
  publicationStatusEnum,
  workflowStatusEnum,
} from "./enums";
import { media } from "./media";
import { staffUsers } from "./staff";
import { categories, tags } from "./taxonomy";

export const contentVersions = pgTable(
  "content_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references((): AnyPgColumn => contentItems.id, { onDelete: "restrict" }),
    versionNumber: integer("version_number").notNull(),
    workflowStatus: workflowStatusEnum("workflow_status").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    excerpt: text("excerpt"),
    body: jsonb("body").notNull(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    canonicalUrl: text("canonical_url"),
    robots: text("robots"),
    credibility: credibilityEnum("credibility"),
    credibilitySource: text("credibility_source"),
    source: text("source"),
    sourceOrganization: text("source_organization"),
    sourceUrl: text("source_url"),
    syndicated: boolean("syndicated").notNull().default(false),
    isMaterialUpdate: boolean("is_material_update").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("content_versions_content_item_id_id_key").on(
      table.contentItemId,
      table.id,
    ),
    unique("content_versions_content_item_id_version_number_key").on(
      table.contentItemId,
      table.versionNumber,
    ),
    check(
      "content_versions_version_number_positive",
      sql`${table.versionNumber} > 0`,
    ),
    uniqueIndex("content_versions_one_in_review")
      .on(table.contentItemId)
      .where(sql`${table.workflowStatus} = 'IN_REVIEW'`),
  ],
);

/**
 * Append-only post-publication legal/editorial actions.
 * Application code must only INSERT. There is no update/delete API.
 */
export const contentLegalActions = pgTable(
  "content_legal_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references((): AnyPgColumn => contentItems.id, { onDelete: "restrict" }),
    contentVersionId: uuid("content_version_id"),
    actionType: contentLegalActionTypeEnum("action_type").notNull(),
    polarity: contentLegalActionPolarityEnum("polarity").notNull(),
    reasonCategory: contentLegalReasonCategoryEnum("reason_category").notNull(),
    internalNote: text("internal_note").notNull(),
    publicNote: text("public_note"),
    actorStaffUserId: uuid("actor_staff_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("content_legal_actions_content_item_id_id_key").on(
      table.contentItemId,
      table.id,
    ),
    foreignKey({
      name: "content_legal_actions_version_fk",
      columns: [table.contentItemId, table.contentVersionId],
      foreignColumns: [contentVersions.contentItemId, contentVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_legal_actions_actor_staff_fk",
      columns: [table.actorStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
    index("content_legal_actions_item_created_idx").on(
      table.contentItemId,
      table.createdAt,
      table.id,
    ),
    check(
      "content_legal_actions_internal_note_bounds",
      sql`char_length(${table.internalNote}) BETWEEN 3 AND 4000`,
    ),
    check(
      "content_legal_actions_public_note_bounds",
      sql`${table.publicNote} IS NULL OR char_length(${table.publicNote}) BETWEEN 1 AND 4000`,
    ),
    check(
      "content_legal_actions_polarity_by_type",
      sql`(
        (${table.actionType} = 'LEGAL_HOLD')
        OR
        (${table.polarity} = 'APPLY')
      )`,
    ),
  ],
);

export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    publicationStatus: publicationStatusEnum("publication_status")
      .notNull()
      .default("NEVER_PUBLISHED"),
    publishedVersionId: uuid("published_version_id"),
    draftVersionId: uuid("draft_version_id"),
    scheduledVersionId: uuid("scheduled_version_id"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    scheduleGeneration: integer("schedule_generation").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publicDateModified: timestamp("public_date_modified", {
      withTimezone: true,
    }),
    postPublishReviewRequired: boolean("post_publish_review_required")
      .notNull()
      .default(false),
    legalHoldAt: timestamp("legal_hold_at", { withTimezone: true }),
    legalHoldReason: text("legal_hold_reason"),
    legalHoldActionId: uuid("legal_hold_action_id"),
    retractedAt: timestamp("retracted_at", { withTimezone: true }),
    retractedActionId: uuid("retracted_action_id"),
    takedownAt: timestamp("takedown_at", { withTimezone: true }),
    takedownActionId: uuid("takedown_action_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("content_items_slug_key").on(table.slug),
    check(
      "content_items_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(${table.slug}) BETWEEN 1 AND 200`,
    ),
    check(
      "content_items_schedule_generation_non_negative",
      sql`${table.scheduleGeneration} >= 0`,
    ),
    check(
      "content_items_schedule_pair",
      sql`(
        (${table.scheduledVersionId} IS NULL AND ${table.scheduledAt} IS NULL)
        OR
        (${table.scheduledVersionId} IS NOT NULL AND ${table.scheduledAt} IS NOT NULL)
      )`,
    ),
    check(
      "content_items_published_draft_pointers_distinct",
      sql`${table.publishedVersionId} IS NULL
        OR ${table.draftVersionId} IS NULL
        OR ${table.publishedVersionId} IS DISTINCT FROM ${table.draftVersionId}`,
    ),
    check(
      "content_items_published_scheduled_pointers_distinct",
      sql`${table.publishedVersionId} IS NULL
        OR ${table.scheduledVersionId} IS NULL
        OR ${table.publishedVersionId} IS DISTINCT FROM ${table.scheduledVersionId}`,
    ),
    check(
      "content_items_draft_scheduled_pointers_distinct",
      sql`${table.draftVersionId} IS NULL
        OR ${table.scheduledVersionId} IS NULL
        OR ${table.draftVersionId} IS DISTINCT FROM ${table.scheduledVersionId}`,
    ),
    check(
      "content_items_published_state_coherent",
      sql`${table.publicationStatus} <> 'PUBLISHED'
        OR (
          ${table.publishedVersionId} IS NOT NULL
          AND ${table.publishedAt} IS NOT NULL
        )`,
    ),
    check(
      "content_items_legal_hold_state_coherent",
      sql`(
        (${table.legalHoldAt} IS NULL AND ${table.legalHoldReason} IS NULL AND ${table.legalHoldActionId} IS NULL)
        OR
        (${table.legalHoldAt} IS NOT NULL AND ${table.legalHoldReason} IS NOT NULL AND ${table.legalHoldActionId} IS NOT NULL)
      )`,
    ),
    check(
      "content_items_legal_hold_reason_length",
      sql`${table.legalHoldReason} IS NULL OR char_length(${table.legalHoldReason}) BETWEEN 1 AND 64`,
    ),
    check(
      "content_items_retracted_state_coherent",
      sql`(
        (${table.retractedAt} IS NULL AND ${table.retractedActionId} IS NULL)
        OR
        (${table.retractedAt} IS NOT NULL AND ${table.retractedActionId} IS NOT NULL)
      )`,
    ),
    check(
      "content_items_takedown_state_coherent",
      sql`(
        (${table.takedownAt} IS NULL AND ${table.takedownActionId} IS NULL)
        OR
        (${table.takedownAt} IS NOT NULL AND ${table.takedownActionId} IS NOT NULL)
      )`,
    ),
    foreignKey({
      name: "content_items_published_version_same_item_fk",
      columns: [table.id, table.publishedVersionId],
      foreignColumns: [contentVersions.contentItemId, contentVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_items_draft_version_same_item_fk",
      columns: [table.id, table.draftVersionId],
      foreignColumns: [contentVersions.contentItemId, contentVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_items_scheduled_version_same_item_fk",
      columns: [table.id, table.scheduledVersionId],
      foreignColumns: [contentVersions.contentItemId, contentVersions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_items_legal_hold_action_same_item_fk",
      columns: [table.id, table.legalHoldActionId],
      foreignColumns: [contentLegalActions.contentItemId, contentLegalActions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_items_retracted_action_same_item_fk",
      columns: [table.id, table.retractedActionId],
      foreignColumns: [contentLegalActions.contentItemId, contentLegalActions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "content_items_takedown_action_same_item_fk",
      columns: [table.id, table.takedownActionId],
      foreignColumns: [contentLegalActions.contentItemId, contentLegalActions.id],
    }).onDelete("restrict"),
  ],
);

export const contentVersionCategories = pgTable(
  "content_version_categories",
  {
    contentVersionId: uuid("content_version_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (table) => [
    primaryKey({
      name: "content_version_categories_pk",
      columns: [table.contentVersionId, table.categoryId],
    }),
    foreignKey({
      name: "content_version_categories_version_fk",
      columns: [table.contentVersionId],
      foreignColumns: [contentVersions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "content_version_categories_category_fk",
      columns: [table.categoryId],
      foreignColumns: [categories.id],
    }).onDelete("restrict"),
    uniqueIndex("content_version_categories_one_primary")
      .on(table.contentVersionId)
      .where(sql`${table.isPrimary} = true`),
  ],
);

export const contentVersionTags = pgTable(
  "content_version_tags",
  {
    contentVersionId: uuid("content_version_id").notNull(),
    tagId: uuid("tag_id").notNull(),
  },
  (table) => [
    primaryKey({
      name: "content_version_tags_pk",
      columns: [table.contentVersionId, table.tagId],
    }),
    foreignKey({
      name: "content_version_tags_version_fk",
      columns: [table.contentVersionId],
      foreignColumns: [contentVersions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "content_version_tags_tag_fk",
      columns: [table.tagId],
      foreignColumns: [tags.id],
    }).onDelete("restrict"),
  ],
);

export const contentVersionEntities = pgTable(
  "content_version_entities",
  {
    contentVersionId: uuid("content_version_id").notNull(),
    entityId: uuid("entity_id").notNull(),
    role: entityRoleEnum("role").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: "content_version_entities_pk",
      columns: [table.contentVersionId, table.entityId],
    }),
    foreignKey({
      name: "content_version_entities_version_fk",
      columns: [table.contentVersionId],
      foreignColumns: [contentVersions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "content_version_entities_entity_fk",
      columns: [table.entityId],
      foreignColumns: [entities.id],
    }).onDelete("restrict"),
    index("content_version_entities_entity_idx").on(table.entityId),
    check(
      "content_version_entities_sort_order_non_negative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const contentVersionMedia = pgTable(
  "content_version_media",
  {
    contentVersionId: uuid("content_version_id").notNull(),
    mediaId: uuid("media_id").notNull(),
    role: mediaRoleEnum("role").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    caption: text("caption"),
    altText: text("alt_text"),
    credit: text("credit"),
  },
  (table) => [
    primaryKey({
      name: "content_version_media_pk",
      columns: [table.contentVersionId, table.mediaId, table.role],
    }),
    foreignKey({
      name: "content_version_media_version_fk",
      columns: [table.contentVersionId],
      foreignColumns: [contentVersions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "content_version_media_media_fk",
      columns: [table.mediaId],
      foreignColumns: [media.id],
    }).onDelete("restrict"),
    uniqueIndex("content_version_media_one_hero")
      .on(table.contentVersionId)
      .where(sql`${table.role} = 'HERO'`),
    uniqueIndex("content_version_media_gallery_sort_order")
      .on(table.contentVersionId, table.sortOrder)
      .where(sql`${table.role} = 'GALLERY'`),
    check(
      "content_version_media_sort_order_non_negative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const contentVersionAuthors = pgTable(
  "content_version_authors",
  {
    contentVersionId: uuid("content_version_id").notNull(),
    authorId: uuid("author_id").notNull(),
    role: authorRoleEnum("role").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: "content_version_authors_pk",
      columns: [table.contentVersionId, table.authorId],
    }),
    foreignKey({
      name: "content_version_authors_version_fk",
      columns: [table.contentVersionId],
      foreignColumns: [contentVersions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "content_version_authors_author_fk",
      columns: [table.authorId],
      foreignColumns: [authors.id],
    }).onDelete("restrict"),
    check(
      "content_version_authors_sort_order_non_negative",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);
