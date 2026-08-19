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
}
