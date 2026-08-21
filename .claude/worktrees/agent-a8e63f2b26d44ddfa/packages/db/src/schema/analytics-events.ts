import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  AnalyticsEventName,
  AnalyticsPlacement,
  AnalyticsStoredProperties,
  AnalyticsSurface,
  AnalyticsTrafficKind,
  AnalyticsTrafficSource,
} from "@magazine/domain";

/**
 * Append-only public analytics facts. Not editorial audit, not ad billing.
 * Application code must only INSERT. Dedupes on event_id.
 *
 * Content IDs are stored without foreign keys so later editorial cleanup
 * cannot cascade-delete historical analytics facts. Analytics is never the
 * content source of truth.
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    eventId: uuid("event_id").primaryKey(),
    schemaVersion: integer("schema_version").notNull(),
    eventName: text("event_name").$type<AnalyticsEventName>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    anonymousSessionId: uuid("anonymous_session_id"),
    anonymousVisitorId: uuid("anonymous_visitor_id"),
    trafficKind: text("traffic_kind").$type<AnalyticsTrafficKind>().notNull(),
    trafficSource: text("traffic_source").$type<AnalyticsTrafficSource>().notNull(),
    referrerHost: text("referrer_host"),
    contentItemId: uuid("content_item_id"),
    publishedVersionId: uuid("published_version_id"),
    publicSlug: text("public_slug"),
    surface: text("surface").$type<AnalyticsSurface>().notNull(),
    placement: text("placement").$type<AnalyticsPlacement>(),
    homepageVersionId: uuid("homepage_version_id"),
    position: integer("position"),
    mediaId: uuid("media_id"),
    videoAssetId: uuid("video_asset_id"),
    primaryCategoryId: uuid("primary_category_id"),
    authorIds: uuid("author_ids").array(),
    factFingerprint: text("fact_fingerprint").notNull(),
    properties: jsonb("properties")
      .$type<AnalyticsStoredProperties>()
      .notNull()
      .default(sql`'{}'::jsonb`),
  },
  (table) => [
    check("analytics_events_schema_version_check", sql`${table.schemaVersion} = 1`),
    check(
      "analytics_events_event_name_check",
      sql`${table.eventName} IN (
        'PAGE_VIEW',
        'ARTICLE_VIEW',
        'HOMEPAGE_VIEW',
        'HOMEPAGE_CONTENT_IMPRESSION',
        'HOMEPAGE_CONTENT_CLICK',
        'GALLERY_OPEN',
        'GALLERY_IMAGE_VIEW',
        'GALLERY_NAVIGATE',
        'VIDEO_IMPRESSION',
        'VIDEO_PLAY',
        'ARTICLE_OUTBOUND_CLICK',
        'ARTICLE_INTERNAL_CLICK'
      )`,
    ),
    check(
      "analytics_events_traffic_kind_check",
      sql`${table.trafficKind} IN ('HUMAN', 'BOT', 'INTERNAL', 'TEST', 'UNKNOWN')`,
    ),
    check(
      "analytics_events_traffic_source_check",
      sql`${table.trafficSource} IN ('DIRECT', 'SEARCH', 'SOCIAL', 'INTERNAL', 'REFERRAL', 'UNKNOWN')`,
    ),
    check(
      "analytics_events_surface_check",
      sql`${table.surface} IN ('HOMEPAGE', 'ARTICLE', 'WITHDRAWN_SHELL', 'OTHER_PUBLIC')`,
    ),
    check(
      "analytics_events_placement_check",
      sql`${table.placement} IS NULL OR ${table.placement} IN (
        'LEAD',
        'SUPPORT_1',
        'SUPPORT_2',
        'FEATURED_1',
        'FEATURED_2',
        'FEATURED_3',
        'FEATURED_4',
        'FEATURED_5',
        'CONVERSATION',
        'RECENCY_FALLBACK',
        'HOMEPAGE_VIDEO',
        'ARTICLE_GALLERY',
        'ARTICLE_VIDEO',
        'ARTICLE_BODY'
      )`,
    ),
    check(
      "analytics_events_properties_object",
      sql`jsonb_typeof(${table.properties}) = 'object'`,
    ),
    check(
      "analytics_events_referrer_host_length",
      sql`${table.referrerHost} IS NULL OR char_length(${table.referrerHost}) BETWEEN 1 AND 253`,
    ),
    check(
      "analytics_events_public_slug_length",
      sql`${table.publicSlug} IS NULL OR char_length(${table.publicSlug}) BETWEEN 1 AND 200`,
    ),
    check(
      "analytics_events_fact_fingerprint_length",
      sql`char_length(${table.factFingerprint}) = 64`,
    ),
    check(
      "analytics_events_author_ids_bounds",
      sql`${table.authorIds} IS NULL OR cardinality(${table.authorIds}) BETWEEN 1 AND 8`,
    ),
    index("analytics_events_name_occurred_idx").on(
      table.eventName,
      table.occurredAt,
      table.eventId,
    ),
    index("analytics_events_content_name_occurred_idx").on(
      table.contentItemId,
      table.eventName,
      table.occurredAt,
    ),
    index("analytics_events_traffic_name_occurred_idx").on(
      table.trafficKind,
      table.eventName,
      table.occurredAt,
    ),
    index("analytics_events_received_at_idx").on(table.receivedAt),
    index("analytics_events_occurred_at_idx").on(table.occurredAt),
    index("analytics_events_published_occurred_idx").on(
      table.publishedVersionId,
      table.occurredAt,
    ),
    index("analytics_events_homepage_occurred_idx").on(
      table.homepageVersionId,
      table.occurredAt,
    ),
    index("analytics_events_traffic_occurred_idx").on(
      table.trafficKind,
      table.occurredAt,
    ),
  ],
);
