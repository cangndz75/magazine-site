import { and, eq, gte, lt, sql } from "drizzle-orm";
import {
  ANALYTICS_AGGREGATION_JOB_NAME,
  alignAnalyticsAggregationWindow,
  analyticsLateArrivalFrom,
  computeAnalyticsAggregates,
  type AnalyticsAggregateFact,
  type AnalyticsAggregateBatch,
  type AnalyticsAggregationQuality,
} from "@magazine/domain";
import { getDb } from "../client";
import { analyticsEvents } from "../schema/analytics-events";
import {
  analyticsAggregationCheckpoints,
  analyticsAuthorDaily,
  analyticsCategoryDaily,
  analyticsContentDaily,
  analyticsContentHourly,
  analyticsHomepageSlotDaily,
  analyticsHomepageSlotHourly,
  analyticsMediaDaily,
  analyticsSessionDaily,
  analyticsSourceDaily,
  analyticsVideoDaily,
} from "../schema/analytics-aggregates";

const INSERT_CHUNK = 500;
const ERROR_SUMMARY_MAX = 200;

export type AggregateAnalyticsWindowInput = {
  from: Date;
  to: Date;
};

export type AggregateAnalyticsWindowResult =
  | {
      ok: true;
      fromInclusive: Date;
      toExclusive: Date;
      quality: AnalyticsAggregationQuality;
    }
  | {
      ok: false;
      code: "INVALID_RANGE" | "RANGE_TOO_LARGE";
    };

type AnalyticsTx = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

function asFacts(
  rows: Array<{
    eventId: string;
    schemaVersion: number;
    eventName: AnalyticsAggregateFact["eventName"];
    occurredAt: Date;
    anonymousSessionId: string | null;
    trafficKind: AnalyticsAggregateFact["trafficKind"];
    trafficSource: AnalyticsAggregateFact["trafficSource"];
    referrerHost: string | null;
    contentItemId: string | null;
    publishedVersionId: string | null;
    surface: AnalyticsAggregateFact["surface"];
    placement: AnalyticsAggregateFact["placement"];
    homepageVersionId: string | null;
    position: number | null;
    mediaId: string | null;
    videoAssetId: string | null;
    primaryCategoryId: string | null;
    authorIds: string[] | null;
  }>,
): AnalyticsAggregateFact[] {
  return rows.map((row) => ({
    eventId: row.eventId,
    schemaVersion: row.schemaVersion,
    occurredAt: row.occurredAt,
    anonymousSessionId: row.anonymousSessionId,
    trafficKind: row.trafficKind,
    trafficSource: row.trafficSource,
    referrerHost: row.referrerHost,
    contentItemId: row.contentItemId,
    publishedVersionId: row.publishedVersionId,
    surface: row.surface,
    placement: row.placement,
    homepageVersionId: row.homepageVersionId,
    position: row.position,
    mediaId: row.mediaId,
    videoAssetId: row.videoAssetId,
    primaryCategoryId: row.primaryCategoryId,
    authorIds: row.authorIds,
    eventName: row.eventName,
  }));
}

async function insertChunked<T>(
  rows: readonly T[],
  write: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += INSERT_CHUNK) {
    const chunk = rows.slice(index, index + INSERT_CHUNK);
    if (chunk.length > 0) {
      await write(chunk);
    }
  }
}

function safeErrorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : "aggregation failed";
  return message.replace(/\s+/g, " ").slice(0, ERROR_SUMMARY_MAX);
}

async function replaceWindow(
  tx: AnalyticsTx,
  fromInclusive: Date,
  toExclusive: Date,
  batch: AnalyticsAggregateBatch,
): Promise<void> {
  const inRange = (column: Parameters<typeof gte>[0]) =>
    and(gte(column, fromInclusive), lt(column, toExclusive));

  await tx.delete(analyticsContentHourly).where(inRange(analyticsContentHourly.bucketStart));
  await tx.delete(analyticsContentDaily).where(inRange(analyticsContentDaily.bucketStart));
  await tx
    .delete(analyticsHomepageSlotHourly)
    .where(inRange(analyticsHomepageSlotHourly.bucketStart));
  await tx
    .delete(analyticsHomepageSlotDaily)
    .where(inRange(analyticsHomepageSlotDaily.bucketStart));
  await tx.delete(analyticsSourceDaily).where(inRange(analyticsSourceDaily.bucketStart));
  await tx.delete(analyticsCategoryDaily).where(inRange(analyticsCategoryDaily.bucketStart));
  await tx.delete(analyticsAuthorDaily).where(inRange(analyticsAuthorDaily.bucketStart));
  await tx.delete(analyticsMediaDaily).where(inRange(analyticsMediaDaily.bucketStart));
  await tx.delete(analyticsVideoDaily).where(inRange(analyticsVideoDaily.bucketStart));
  await tx.delete(analyticsSessionDaily).where(inRange(analyticsSessionDaily.bucketStart));

  await insertChunked(batch.contentHourly, (chunk) =>
    tx.insert(analyticsContentHourly).values(chunk),
  );
  await insertChunked(batch.contentDaily, (chunk) =>
    tx.insert(analyticsContentDaily).values(chunk),
  );
  await insertChunked(batch.homepageSlotHourly, (chunk) =>
    tx.insert(analyticsHomepageSlotHourly).values(chunk),
  );
  await insertChunked(batch.homepageSlotDaily, (chunk) =>
    tx.insert(analyticsHomepageSlotDaily).values(chunk),
  );
  await insertChunked(batch.sourceDaily, (chunk) =>
    tx.insert(analyticsSourceDaily).values(chunk),
  );
  await insertChunked(batch.categoryDaily, (chunk) =>
    tx.insert(analyticsCategoryDaily).values(chunk),
  );
  await insertChunked(batch.authorDaily, (chunk) =>
    tx.insert(analyticsAuthorDaily).values(chunk),
  );
  await insertChunked(batch.mediaDaily, (chunk) =>
    tx.insert(analyticsMediaDaily).values(chunk),
  );
  await insertChunked(batch.videoDaily, (chunk) =>
    tx.insert(analyticsVideoDaily).values(chunk),
  );
  await insertChunked(batch.sessionDaily, (chunk) =>
    tx.insert(analyticsSessionDaily).values(chunk),
  );
}

/**
 * Bounded idempotent recompute. Replaces aggregate rows for UTC days that
 * cover [from, to). Does not increment existing counters. Does not delete raw events.
 */
export async function aggregateAnalyticsWindow(
  input: AggregateAnalyticsWindowInput,
): Promise<AggregateAnalyticsWindowResult> {
  const aligned = alignAnalyticsAggregationWindow(input);
  if (!aligned.ok) {
    return aligned;
  }

  const db = getDb();
  const startedAt = new Date();

  try {
    const quality = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${ANALYTICS_AGGREGATION_JOB_NAME}))`,
      );

      await tx
        .insert(analyticsAggregationCheckpoints)
        .values({
          jobName: ANALYTICS_AGGREGATION_JOB_NAME,
          lastStartedAt: startedAt,
          lastQuality: {},
        })
        .onConflictDoUpdate({
          target: analyticsAggregationCheckpoints.jobName,
          set: {
            lastStartedAt: startedAt,
            lastErrorSafeSummary: null,
          },
        });

      const rows = await tx
        .select({
          eventId: analyticsEvents.eventId,
          schemaVersion: analyticsEvents.schemaVersion,
          eventName: analyticsEvents.eventName,
          occurredAt: analyticsEvents.occurredAt,
          anonymousSessionId: analyticsEvents.anonymousSessionId,
          trafficKind: analyticsEvents.trafficKind,
          trafficSource: analyticsEvents.trafficSource,
          referrerHost: analyticsEvents.referrerHost,
          contentItemId: analyticsEvents.contentItemId,
          publishedVersionId: analyticsEvents.publishedVersionId,
          surface: analyticsEvents.surface,
          placement: analyticsEvents.placement,
          homepageVersionId: analyticsEvents.homepageVersionId,
          position: analyticsEvents.position,
          mediaId: analyticsEvents.mediaId,
          videoAssetId: analyticsEvents.videoAssetId,
          primaryCategoryId: analyticsEvents.primaryCategoryId,
          authorIds: analyticsEvents.authorIds,
        })
        .from(analyticsEvents)
        .where(
          and(
            gte(analyticsEvents.occurredAt, aligned.fromInclusive),
            lt(analyticsEvents.occurredAt, aligned.toExclusive),
          ),
        );

      const batch = computeAnalyticsAggregates(asFacts(rows));
      await replaceWindow(tx, aligned.fromInclusive, aligned.toExclusive, batch);

      await tx
        .update(analyticsAggregationCheckpoints)
        .set({
          lastSuccessfulThrough: aligned.toExclusive,
          lastCompletedAt: new Date(),
          lastErrorSafeSummary: null,
          lastQuality: batch.quality,
        })
        .where(eq(analyticsAggregationCheckpoints.jobName, ANALYTICS_AGGREGATION_JOB_NAME));

      return batch.quality;
    });

    return {
      ok: true,
      fromInclusive: aligned.fromInclusive,
      toExclusive: aligned.toExclusive,
      quality,
    };
  } catch (error) {
    const summary = safeErrorSummary(error);
    try {
      await db
        .insert(analyticsAggregationCheckpoints)
        .values({
          jobName: ANALYTICS_AGGREGATION_JOB_NAME,
          lastStartedAt: startedAt,
          lastErrorSafeSummary: summary,
          lastQuality: {},
        })
        .onConflictDoUpdate({
          target: analyticsAggregationCheckpoints.jobName,
          set: {
            lastErrorSafeSummary: summary,
          },
        });
    } catch {
      // Checkpoint write is operational only.
    }
    throw error;
  }
}

export function aggregateRecentAnalyticsWindow(now = new Date()) {
  return aggregateAnalyticsWindow({
    from: analyticsLateArrivalFrom(now),
    to: now,
  });
}
