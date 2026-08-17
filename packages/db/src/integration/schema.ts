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
 * Apply journaled migrations 0000 and 0001, then 0003 review events when needed.
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
}
