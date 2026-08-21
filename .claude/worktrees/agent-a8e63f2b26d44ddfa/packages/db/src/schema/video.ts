import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  VIDEO_DURATION_SECONDS_MAX,
  VIDEO_TEXT_MAX,
} from "@magazine/domain";
import { contentVersions } from "./content";
import { media } from "./media";
import { videoProviderEnum } from "./enums";

export const editorialVideoAssets = pgTable(
  "editorial_video_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: videoProviderEnum("provider").notNull(),
    providerVideoId: text("provider_video_id").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    submittedUrl: text("submitted_url").notNull(),
    title: text("title").notNull(),
    caption: text("caption"),
    description: text("description"),
    durationSeconds: integer("duration_seconds"),
    posterMediaId: uuid("poster_media_id").references(() => media.id, {
      onDelete: "restrict",
    }),
    rightsNote: text("rights_note"),
    provenance: text("provenance"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("editorial_video_assets_provider_video_key").on(
      table.provider,
      table.providerVideoId,
    ),
    check(
      "editorial_video_assets_provider_video_id_length",
      sql`char_length(${table.providerVideoId}) BETWEEN 6 AND 64`,
    ),
    check(
      "editorial_video_assets_canonical_url_length",
      sql`char_length(${table.canonicalUrl}) BETWEEN 1 AND 500`,
    ),
    check(
      "editorial_video_assets_submitted_url_length",
      sql`char_length(${table.submittedUrl}) BETWEEN 1 AND 500`,
    ),
    check(
      "editorial_video_assets_title_length",
      sql`char_length(${table.title}) BETWEEN 1 AND ${VIDEO_TEXT_MAX.TITLE}`,
    ),
    check(
      "editorial_video_assets_caption_length",
      sql`${table.caption} IS NULL OR char_length(${table.caption}) BETWEEN 1 AND ${VIDEO_TEXT_MAX.CAPTION}`,
    ),
    check(
      "editorial_video_assets_description_length",
      sql`${table.description} IS NULL OR char_length(${table.description}) BETWEEN 1 AND ${VIDEO_TEXT_MAX.DESCRIPTION}`,
    ),
    check(
      "editorial_video_assets_duration_bounds",
      sql`${table.durationSeconds} IS NULL OR (${table.durationSeconds} > 0 AND ${table.durationSeconds} <= ${VIDEO_DURATION_SECONDS_MAX})`,
    ),
    check(
      "editorial_video_assets_rights_note_length",
      sql`${table.rightsNote} IS NULL OR char_length(${table.rightsNote}) BETWEEN 1 AND ${VIDEO_TEXT_MAX.RIGHTS_NOTE}`,
    ),
    check(
      "editorial_video_assets_provenance_length",
      sql`${table.provenance} IS NULL OR char_length(${table.provenance}) BETWEEN 1 AND ${VIDEO_TEXT_MAX.PROVENANCE}`,
    ),
    index("editorial_video_assets_poster_media_id_idx").on(table.posterMediaId),
  ],
);

export const contentVersionVideos = pgTable(
  "content_version_videos",
  {
    contentVersionId: uuid("content_version_id").notNull(),
    videoAssetId: uuid("video_asset_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    caption: text("caption"),
  },
  (table) => [
    primaryKey({
      name: "content_version_videos_pk",
      columns: [table.contentVersionId, table.videoAssetId],
    }),
    foreignKey({
      name: "content_version_videos_version_fk",
      columns: [table.contentVersionId],
      foreignColumns: [contentVersions.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "content_version_videos_asset_fk",
      columns: [table.videoAssetId],
      foreignColumns: [editorialVideoAssets.id],
    }).onDelete("restrict"),
    uniqueIndex("content_version_videos_sort_order")
      .on(table.contentVersionId, table.sortOrder),
    check(
      "content_version_videos_sort_order_non_negative",
      sql`${table.sortOrder} >= 0`,
    ),
    check(
      "content_version_videos_caption_length",
      sql`${table.caption} IS NULL OR char_length(${table.caption}) BETWEEN 1 AND ${VIDEO_TEXT_MAX.CAPTION}`,
    ),
  ],
);
