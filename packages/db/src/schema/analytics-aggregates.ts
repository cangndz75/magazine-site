import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  AnalyticsPlacement,
  AnalyticsSurface,
  AnalyticsTrafficSource,
} from "@magazine/domain";

/**
 * Derived reporting tables. Raw analytics_events remain source-of-truth.
 * No foreign keys: historical facts must survive editorial cleanup.
 * Hourly bucket timestamps are UTC hour starts. Daily buckets are the
 * configured reporting-calendar midnight stored as a UTC instant
 * (Europe/Istanbul), never the machine local timezone.
 */

const utcTimestamp = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull();

export const analyticsContentHourly = pgTable(
  "analytics_content_hourly",
  {
    bucketStart: utcTimestamp("bucket_start"),
    contentItemId: uuid("content_item_id").notNull(),
    publishedVersionId: uuid("published_version_id").notNull(),
    articleViews: integer("article_views").notNull().default(0),
    galleryOpens: integer("gallery_opens").notNull().default(0),
    galleryImageViews: integer("gallery_image_views").notNull().default(0),
    videoImpressions: integer("video_impressions").notNull().default(0),
    homepageImpressions: integer("homepage_impressions").notNull().default(0),
    homepageClicks: integer("homepage_clicks").notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: "analytics_content_hourly_pk",
      columns: [table.bucketStart, table.contentItemId, table.publishedVersionId],
    }),
    check(
      "analytics_content_hourly_counts_nonnegative",
      sql`${table.articleViews} >= 0 AND ${table.galleryOpens} >= 0 AND ${table.galleryImageViews} >= 0 AND ${table.videoImpressions} >= 0 AND ${table.homepageImpressions} >= 0 AND ${table.homepageClicks} >= 0`,
    ),
    index("analytics_content_hourly_content_bucket_idx").on(
      table.contentItemId,
      table.bucketStart,
    ),
    index("analytics_content_hourly_bucket_idx").on(table.bucketStart),
  ],
);

export const analyticsContentDaily = pgTable(
  "analytics_content_daily",
  {
    bucketStart: utcTimestamp("bucket_start"),
    contentItemId: uuid("content_item_id").notNull(),
    publishedVersionId: uuid("published_version_id").notNull(),
    articleViews: integer("article_views").notNull().default(0),
    galleryOpens: integer("gallery_opens").notNull().default(0),
    galleryImageViews: integer("gallery_image_views").notNull().default(0),
    videoImpressions: integer("video_impressions").notNull().default(0),
    homepageImpressions: integer("homepage_impressions").notNull().default(0),
    homepageClicks: integer("homepage_clicks").notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: "analytics_content_daily_pk",
      columns: [table.bucketStart, table.contentItemId, table.publishedVersionId],
    }),
    check(
      "analytics_content_daily_counts_nonnegative",
      sql`${table.articleViews} >= 0 AND ${table.galleryOpens} >= 0 AND ${table.galleryImageViews} >= 0 AND ${table.videoImpressions} >= 0 AND ${table.homepageImpressions} >= 0 AND ${table.homepageClicks} >= 0`,
    ),
    index("analytics_content_daily_content_bucket_idx").on(
      table.contentItemId,
      table.bucketStart,
    ),
    index("analytics_content_daily_bucket_idx").on(table.bucketStart),
  ],
);

export const analyticsHomepageSlotHourly = pgTable(
  "analytics_homepage_slot_hourly",
  {
    bucketStart: utcTimestamp("bucket_start"),
    homepageVersionId: uuid("homepage_version_id"),
    placement: text("placement").$type<AnalyticsPlacement>().notNull(),
    position: integer("position").notNull(),
    contentItemId: uuid("content_item_id").notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
  },
  (table) => [
    unique("analytics_homepage_slot_hourly_uniq")
      .on(
        table.bucketStart,
        table.homepageVersionId,
        table.placement,
        table.position,
        table.contentItemId,
      )
      .nullsNotDistinct(),
    check(
      "analytics_homepage_slot_hourly_counts_nonnegative",
      sql`${table.impressions} >= 0 AND ${table.clicks} >= 0`,
    ),
    index("analytics_homepage_slot_hourly_version_bucket_idx").on(
      table.homepageVersionId,
      table.bucketStart,
    ),
    index("analytics_homepage_slot_hourly_content_bucket_idx").on(
      table.contentItemId,
      table.bucketStart,
    ),
  ],
);

export const analyticsHomepageSlotDaily = pgTable(
  "analytics_homepage_slot_daily",
  {
    bucketStart: utcTimestamp("bucket_start"),
    homepageVersionId: uuid("homepage_version_id"),
    placement: text("placement").$type<AnalyticsPlacement>().notNull(),
    position: integer("position").notNull(),
    contentItemId: uuid("content_item_id").notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
  },
  (table) => [
    unique("analytics_homepage_slot_daily_uniq")
      .on(
        table.bucketStart,
        table.homepageVersionId,
        table.placement,
        table.position,
        table.contentItemId,
      )
      .nullsNotDistinct(),
    check(
      "analytics_homepage_slot_daily_counts_nonnegative",
      sql`${table.impressions} >= 0 AND ${table.clicks} >= 0`,
    ),
    index("analytics_homepage_slot_daily_version_bucket_idx").on(
      table.homepageVersionId,
      table.bucketStart,
    ),
    index("analytics_homepage_slot_daily_content_bucket_idx").on(
      table.contentItemId,
      table.bucketStart,
    ),
  ],
);

export const analyticsSourceDaily = pgTable(
  "analytics_source_daily",
  {
    bucketStart: utcTimestamp("bucket_start"),
    trafficSource: text("traffic_source").$type<AnalyticsTrafficSource>().notNull(),
    referrerHost: text("referrer_host"),
    contentItemId: uuid("content_item_id"),
    eventCount: integer("event_count").notNull().default(0),
  },
  (table) => [
    unique("analytics_source_daily_uniq")
      .on(
        table.bucketStart,
        table.trafficSource,
        table.referrerHost,
        table.contentItemId,
      )
      .nullsNotDistinct(),
    check(
      "analytics_source_daily_count_nonnegative",
      sql`${table.eventCount} >= 0`,
    ),
    check(
      "analytics_source_daily_host_length",
      sql`${table.referrerHost} IS NULL OR char_length(${table.referrerHost}) BETWEEN 1 AND 253`,
    ),
    index("analytics_source_daily_bucket_source_idx").on(
      table.bucketStart,
      table.trafficSource,
    ),
    index("analytics_source_daily_content_bucket_idx").on(
      table.contentItemId,
      table.bucketStart,
    ),
  ],
);

export const analyticsCategoryDaily = pgTable(
  "analytics_category_daily",
  {
    bucketStart: utcTimestamp("bucket_start"),
    primaryCategoryId: uuid("primary_category_id").notNull(),
    contentItemId: uuid("content_item_id").notNull(),
    articleViews: integer("article_views").notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: "analytics_category_daily_pk",
      columns: [table.bucketStart, table.primaryCategoryId, table.contentItemId],
    }),
    check(
      "analytics_category_daily_views_nonnegative",
      sql`${table.articleViews} >= 0`,
    ),
    index("analytics_category_daily_category_bucket_idx").on(
      table.primaryCategoryId,
      table.bucketStart,
    ),
  ],
);

export const analyticsAuthorDaily = pgTable(
  "analytics_author_daily",
  {
    bucketStart: utcTimestamp("bucket_start"),
    authorId: uuid("author_id").notNull(),
    contentItemId: uuid("content_item_id").notNull(),
    articleViews: integer("article_views").notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: "analytics_author_daily_pk",
      columns: [table.bucketStart, table.authorId, table.contentItemId],
    }),
    check(
      "analytics_author_daily_views_nonnegative",
      sql`${table.articleViews} >= 0`,
    ),
    index("analytics_author_daily_author_bucket_idx").on(
      table.authorId,
      table.bucketStart,
    ),
  ],
);

export const analyticsMediaDaily = pgTable(
  "analytics_media_daily",
  {
    bucketStart: utcTimestamp("bucket_start"),
    contentItemId: uuid("content_item_id").notNull(),
    mediaId: uuid("media_id").notNull(),
    galleryOpens: integer("gallery_opens").notNull().default(0),
    galleryImageViews: integer("gallery_image_views").notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: "analytics_media_daily_pk",
      columns: [table.bucketStart, table.contentItemId, table.mediaId],
    }),
    check(
      "analytics_media_daily_counts_nonnegative",
      sql`${table.galleryOpens} >= 0 AND ${table.galleryImageViews} >= 0`,
    ),
  ],
);

export const analyticsVideoDaily = pgTable(
  "analytics_video_daily",
  {
    bucketStart: utcTimestamp("bucket_start"),
    videoAssetId: uuid("video_asset_id").notNull(),
    surface: text("surface").$type<AnalyticsSurface>().notNull(),
    contentItemId: uuid("content_item_id"),
    homepageVersionId: uuid("homepage_version_id"),
    impressions: integer("impressions").notNull().default(0),
  },
  (table) => [
    unique("analytics_video_daily_uniq")
      .on(
        table.bucketStart,
        table.videoAssetId,
        table.surface,
        table.contentItemId,
        table.homepageVersionId,
      )
      .nullsNotDistinct(),
    check(
      "analytics_video_daily_impressions_nonnegative",
      sql`${table.impressions} >= 0`,
    ),
  ],
);

export const analyticsSessionDaily = pgTable(
  "analytics_session_daily",
  {
    bucketStart: utcTimestamp("bucket_start"),
    anonymousSessionId: uuid("anonymous_session_id").notNull(),
    contentItemId: uuid("content_item_id"),
  },
  (table) => [
    unique("analytics_session_daily_uniq")
      .on(table.bucketStart, table.anonymousSessionId, table.contentItemId)
      .nullsNotDistinct(),
    index("analytics_session_daily_bucket_idx").on(table.bucketStart),
  ],
);

export const analyticsAggregationCheckpoints = pgTable(
  "analytics_aggregation_checkpoints",
  {
    jobName: text("job_name").primaryKey(),
    lastSuccessfulThrough: timestamp("last_successful_through", {
      withTimezone: true,
    }),
    lastStartedAt: timestamp("last_started_at", { withTimezone: true }),
    lastCompletedAt: timestamp("last_completed_at", { withTimezone: true }),
    lastErrorSafeSummary: text("last_error_safe_summary"),
    lastQuality: jsonb("last_quality").notNull().default(sql`'{}'::jsonb`),
  },
  (table) => [
    check(
      "analytics_aggregation_checkpoints_job_name_length",
      sql`char_length(${table.jobName}) BETWEEN 1 AND 100`,
    ),
    check(
      "analytics_aggregation_checkpoints_error_length",
      sql`${table.lastErrorSafeSummary} IS NULL OR char_length(${table.lastErrorSafeSummary}) BETWEEN 1 AND 200`,
    ),
  ],
);
