import { ANALYTICS_RETENTION_POLICY, parseAnalyticsRawRetentionDays } from "@magazine/domain";
import { sql } from "drizzle-orm";
import { getDb } from "../client";
import { analyticsEvents } from "../schema/analytics-events";

const DEFAULT_BATCH_LIMIT = 1000;

/**
 * Bounded raw-event deletion. Not scheduled. Retention enforcement is
 * ENFORCEMENT_PENDING until a recurring job exists.
 */
export async function deleteExpiredAnalyticsEvents(input: {
  now: Date;
  retentionDays?: number;
  limit?: number;
}): Promise<{ deleted: number }> {
  const retentionDays = parseAnalyticsRawRetentionDays(
    input.retentionDays ?? ANALYTICS_RETENTION_POLICY.DEFAULT_RAW_DAYS,
  );
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_BATCH_LIMIT, 1), DEFAULT_BATCH_LIMIT);
  const cutoff = new Date(input.now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const db = getDb();
  const deleted = await db.execute(
    sql`DELETE FROM ${analyticsEvents}
        WHERE event_id IN (
          SELECT event_id FROM ${analyticsEvents}
          WHERE received_at < ${cutoff}
          ORDER BY received_at ASC
          LIMIT ${limit}
        )`,
  );
  const rowCount =
    typeof deleted === "object" && deleted !== null && "rowCount" in deleted
      ? Number(deleted.rowCount ?? 0)
      : 0;
  return { deleted: rowCount };
}
