import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "pg";

const DRIZZLE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

const JOURNALED_SQL_FILES = [
  "0000_content-core.sql",
  "0001_auth-foundation.sql",
] as const;

const REVIEW_EVENTS_SQL = "0003_content-review-events.sql";
const AUDIT_EVENTS_SQL = "0004_content-audit-events.sql";
const PUBLIC_CACHE_OUTBOX_SQL = "0005_public-cache-outbox.sql";
const HOMEPAGE_CONVERSATION_SQL = "0006_homepage-conversation.sql";
const HOMEPAGE_BUILDER_SQL = "0007_homepage-builder.sql";
const MEDIA_RIGHTS_SQL = "0008_media-rights-foundation.sql";
const MEDIA_UPLOAD_SQL = "0009_media-upload-original-filename.sql";
const ARTICLE_GALLERY_SQL = "0010_article-gallery-foundation.sql";
const EDITORIAL_VIDEO_SQL = "0011_editorial-video-foundation.sql";
const HOMEPAGE_VIDEO_SLOT_SQL = "0012_homepage-video-slot.sql";
const MEDIA_IMAGE_RENDITIONS_SQL = "0013_media-image-renditions.sql";
const EDITORIAL_LEGAL_ACTIONS_SQL = "0014_editorial-legal-actions.sql";
const STAFF_ADMINISTRATION_SQL = "0015_staff-administration-foundation.sql";
const STAFF_MFA_RUNTIME_SQL = "0016_staff-mfa-runtime.sql";
const CONTENT_SLUG_HISTORY_SQL = "0017_content-slug-history.sql";
const ANALYTICS_EVENTS_SQL = "0018_analytics-events-foundation.sql";
const ANALYTICS_EVENTS_INGESTION_SQL = "0019_analytics-events-ingestion.sql";
const ANALYTICS_AGGREGATES_SQL = "0020_analytics-aggregates.sql";
const ANALYTICS_RECENCY_FALLBACK_PLACEMENT_SQL =
  "0021_analytics-recency-fallback-placement.sql";
const ENTITY_PLATFORM_SQL = "0022_entity-platform-foundation.sql";
const PUBLIC_CACHE_OUTBOX_ENTITY_EVENTS_SQL =
  "0023_public-cache-outbox-entity-events.sql";
const PHOTO_GALLERY_CONTENT_KIND_SQL = "0024_photo-gallery-content-kind.sql";
const FEATURE_CONTROLS_SQL = "0025_feature-controls.sql";
const REDIRECT_MANAGEMENT_SQL = "0026_redirect-management.sql";

async function publicColumnExists(
  client: Client,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tableName, columnName],
  );
  return result.rows[0]?.exists === true;
}

async function publicTableExists(
  client: Client,
  tableName: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = $1
     ) AS exists`,
    [tableName],
  );

  return result.rows[0]?.exists === true;
}

function statementsFromDrizzleSql(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function applySqlFile(client: Client, fileName: string): Promise<void> {
  const sql = readFileSync(path.join(DRIZZLE_DIR, fileName), "utf8");
  for (const statement of statementsFromDrizzleSql(sql)) {
    await client.query(statement);
  }
}

/**
 * Apply journaled migrations 0000 and 0001, then later numbered files when needed.
 * Never applies 0002 (parked MFA) or uses drizzle-kit push.
 */
export async function ensureJournaledTestSchema(client: Client): Promise<void> {
  const hasContent = await publicTableExists(client, "content_items");
  const hasStaff = await publicTableExists(client, "staff_users");

  if (hasContent !== hasStaff) {
    throw new Error(
      "Dedicated test database has a partial magazine schema. Recreate the *_test database instead of repairing it in place.",
    );
  }

  if (!hasContent && !hasStaff) {
    for (const fileName of JOURNALED_SQL_FILES) {
      await applySqlFile(client, fileName);
    }
  }

  const hasReviewEvents = await publicTableExists(
    client,
    "content_review_events",
  );
  if (!hasReviewEvents) {
    await applySqlFile(client, REVIEW_EVENTS_SQL);
  }

  const hasAuditEvents = await publicTableExists(client, "content_audit_events");
  if (!hasAuditEvents) {
    await applySqlFile(client, AUDIT_EVENTS_SQL);
  }

  const hasPublicCacheOutbox = await publicTableExists(
    client,
    "public_cache_outbox",
  );
  if (!hasPublicCacheOutbox) {
    await applySqlFile(client, PUBLIC_CACHE_OUTBOX_SQL);
  }

  const hasHomepageConversation = await publicTableExists(
    client,
    "homepage_conversation_items",
  );
  if (!hasHomepageConversation) {
    await applySqlFile(client, HOMEPAGE_CONVERSATION_SQL);
  }

  const hasHomepages = await publicTableExists(client, "homepages");
  if (!hasHomepages) {
    await applySqlFile(client, HOMEPAGE_BUILDER_SQL);
  }

  const hasMediaRights = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'media'
         AND column_name = 'source_kind'
     ) AS exists`,
  );
  if (hasMediaRights.rows[0]?.exists !== true) {
    await applySqlFile(client, MEDIA_RIGHTS_SQL);
  }

  const hasOriginalFilename = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'media'
         AND column_name = 'original_filename'
     ) AS exists`,
  );
  if (hasOriginalFilename.rows[0]?.exists !== true) {
    await applySqlFile(client, MEDIA_UPLOAD_SQL);
  }

  const hasGallerySortOrder = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'content_version_media_gallery_sort_order'
     ) AS exists`,
  );
  if (hasGallerySortOrder.rows[0]?.exists !== true) {
    await applySqlFile(client, ARTICLE_GALLERY_SQL);
  }

  const hasVersionVideos = await publicTableExists(
    client,
    "content_version_videos",
  );
  const hasEditorialVideos = await publicTableExists(
    client,
    "editorial_video_assets",
  );
  if (!hasEditorialVideos && !hasVersionVideos) {
    await applySqlFile(client, EDITORIAL_VIDEO_SQL);
  } else if (!hasVersionVideos) {
    const sql = readFileSync(path.join(DRIZZLE_DIR, EDITORIAL_VIDEO_SQL), "utf8");
    for (const statement of statementsFromDrizzleSql(sql)) {
      if (statement.includes("content_version_videos")) {
        await client.query(statement);
      }
    }
  }

  const hasHomepageVersionVideos = await publicTableExists(
    client,
    "homepage_version_videos",
  );
  if (!hasHomepageVersionVideos) {
    await applySqlFile(client, HOMEPAGE_VIDEO_SLOT_SQL);
  }

  const hasMediaRenditions = await publicTableExists(client, "media_renditions");
  if (!hasMediaRenditions) {
    await applySqlFile(client, MEDIA_IMAGE_RENDITIONS_SQL);
  }

  const hasLegalActions = await publicTableExists(client, "content_legal_actions");
  if (!hasLegalActions) {
    await applySqlFile(client, EDITORIAL_LEGAL_ACTIONS_SQL);
  }

  const hasStaffSecurityAudit = await publicTableExists(
    client,
    "staff_security_audit_events",
  );
  if (!hasStaffSecurityAudit) {
    await applySqlFile(client, STAFF_ADMINISTRATION_SQL);
  }

  const hasLoginChallenges = await publicTableExists(
    client,
    "staff_login_challenges",
  );
  const hasLastVerifiedTotpStep = await publicColumnExists(
    client,
    "staff_mfa_secrets",
    "last_verified_totp_step",
  );
  if (!hasLoginChallenges || !hasLastVerifiedTotpStep) {
    const mfaSql = readFileSync(
      path.join(DRIZZLE_DIR, STAFF_MFA_RUNTIME_SQL),
      "utf8",
    );
    for (const statement of statementsFromDrizzleSql(mfaSql)) {
      if (hasLoginChallenges && statement.includes("staff_login_challenges")) {
        continue;
      }
      if (hasLastVerifiedTotpStep && statement.includes("last_verified_totp_step")) {
        continue;
      }
      await client.query(statement);
    }
  }

  const hasSlugHistory = await publicTableExists(client, "content_slug_history");
  if (!hasSlugHistory) {
    await applySqlFile(client, CONTENT_SLUG_HISTORY_SQL);
  }

  const hasAnalyticsEvents = await publicTableExists(client, "analytics_events");
  if (!hasAnalyticsEvents) {
    await applySqlFile(client, ANALYTICS_EVENTS_SQL);
  }

  const hasAnalyticsFingerprint = await publicColumnExists(
    client,
    "analytics_events",
    "fact_fingerprint",
  );
  if (!hasAnalyticsFingerprint) {
    await applySqlFile(client, ANALYTICS_EVENTS_INGESTION_SQL);
  }

  const hasAnalyticsAggregates = await publicTableExists(
    client,
    "analytics_content_daily",
  );
  if (!hasAnalyticsAggregates) {
    await applySqlFile(client, ANALYTICS_AGGREGATES_SQL);
  }

  const placementAllowsRecencyFallback = await client.query<{ matches: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'analytics_events_placement_check'
         AND pg_get_constraintdef(oid) LIKE '%RECENCY_FALLBACK%'
     ) AS matches`,
  );
  if (placementAllowsRecencyFallback.rows[0]?.matches !== true) {
    await applySqlFile(client, ANALYTICS_RECENCY_FALLBACK_PLACEMENT_SQL);
  }

  const hasEntityStatus = await publicColumnExists(client, "entities", "status");
  const hasEntitySlugHistory = await publicTableExists(
    client,
    "entity_slug_history",
  );
  if (!hasEntityStatus || !hasEntitySlugHistory) {
    await applySqlFile(client, ENTITY_PLATFORM_SQL);
  }

  const entityCacheEventsAllowed = await client.query<{ matches: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'public_cache_outbox_event_type_check'
         AND pg_get_constraintdef(oid) LIKE '%PUBLIC_ENTITY_CACHE_INVALIDATE%'
     ) AS matches`,
  );
  if (entityCacheEventsAllowed.rows[0]?.matches !== true) {
    await applySqlFile(client, PUBLIC_CACHE_OUTBOX_ENTITY_EVENTS_SQL);
  }

  const hasContentKind = await publicColumnExists(
    client,
    "content_items",
    "content_kind",
  );
  if (!hasContentKind) {
    await applySqlFile(client, PHOTO_GALLERY_CONTENT_KIND_SQL);
  }

  const hasFeatureControls = await publicTableExists(client, "feature_controls");
  if (!hasFeatureControls) {
    await applySqlFile(client, FEATURE_CONTROLS_SQL);
  }

  const hasRedirectRules = await publicTableExists(client, "redirect_rules");
  if (!hasRedirectRules) {
    await applySqlFile(client, REDIRECT_MANAGEMENT_SQL);
  }
}
