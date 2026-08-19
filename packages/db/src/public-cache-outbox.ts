import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import {
  publicCacheOutbox,
  type PublicArticleCacheInvalidatePayload,
} from "./schema/outbox";
import type { PublishingTx } from "./publishing/db-types";

export const PUBLIC_CACHE_OUTBOX_EVENT_TYPE = {
  PUBLIC_ARTICLE_CACHE_INVALIDATE: "PUBLIC_ARTICLE_CACHE_INVALIDATE",
} as const;

export const PUBLIC_CACHE_OUTBOX_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  DEAD: "DEAD",
} as const;

export const PUBLIC_CACHE_OUTBOX_DEFAULT_BATCH_LIMIT = 25;
export const PUBLIC_CACHE_OUTBOX_MAX_BATCH_LIMIT = 100;
export const PUBLIC_CACHE_OUTBOX_MAX_ATTEMPTS = 5;
export const PUBLIC_CACHE_OUTBOX_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
export const PUBLIC_CACHE_OUTBOX_ERROR_MAX_LENGTH = 2000;

export type PublicCacheOutboxStatus =
  (typeof PUBLIC_CACHE_OUTBOX_STATUS)[keyof typeof PUBLIC_CACHE_OUTBOX_STATUS];

export type PublicCacheOutboxEvent = {
  id: string;
  eventType: typeof PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ARTICLE_CACHE_INVALIDATE;
  payload: PublicArticleCacheInvalidatePayload;
  status: PublicCacheOutboxStatus;
  attemptCount: number;
  lockedAt: Date;
  createdAt: Date;
};

export async function enqueuePublicArticleCacheInvalidation(
  tx: PublishingTx,
  input: { contentItemId: string; slug: string; now?: Date },
): Promise<void> {
  const now = input.now ?? new Date();
  await tx.insert(publicCacheOutbox).values({
    eventType: PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ARTICLE_CACHE_INVALIDATE,
    payload: {
      schemaVersion: 1,
      contentItemId: input.contentItemId,
      slug: input.slug,
    },
    status: PUBLIC_CACHE_OUTBOX_STATUS.PENDING,
    attemptCount: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

export function clampPublicCacheOutboxBatchLimit(
  limit: number | undefined,
): number {
  if (!Number.isInteger(limit) || (limit ?? 0) <= 0) {
    return PUBLIC_CACHE_OUTBOX_DEFAULT_BATCH_LIMIT;
  }

  return Math.min(
    limit ?? PUBLIC_CACHE_OUTBOX_DEFAULT_BATCH_LIMIT,
    PUBLIC_CACHE_OUTBOX_MAX_BATCH_LIMIT,
  );
}

export async function claimPublicCacheOutboxEvents(
  input: { limit?: number; now?: Date } = {},
): Promise<PublicCacheOutboxEvent[]> {
  const db = getDb();
  const now = input.now ?? new Date();
  const lockExpiredBefore = new Date(
    now.getTime() - PUBLIC_CACHE_OUTBOX_LOCK_TIMEOUT_MS,
  );
  const limit = clampPublicCacheOutboxBatchLimit(input.limit);

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE public_cache_outbox
      SET status = ${PUBLIC_CACHE_OUTBOX_STATUS.DEAD},
          locked_at = NULL,
          last_error = COALESCE(last_error, 'Processing lock expired after max attempts.'),
          updated_at = ${now}
      WHERE status = ${PUBLIC_CACHE_OUTBOX_STATUS.PROCESSING}
        AND locked_at <= ${lockExpiredBefore}
        AND attempt_count >= ${PUBLIC_CACHE_OUTBOX_MAX_ATTEMPTS}
    `);

    const result = await tx.execute(sql<PublicCacheOutboxEvent>`
      WITH picked AS (
        SELECT id
        FROM public_cache_outbox
        WHERE (
          (status = ${PUBLIC_CACHE_OUTBOX_STATUS.PENDING} AND next_attempt_at <= ${now})
          OR
          (status = ${PUBLIC_CACHE_OUTBOX_STATUS.PROCESSING} AND locked_at <= ${lockExpiredBefore})
        )
        AND attempt_count < ${PUBLIC_CACHE_OUTBOX_MAX_ATTEMPTS}
        ORDER BY created_at, id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE public_cache_outbox AS outbox
      SET status = ${PUBLIC_CACHE_OUTBOX_STATUS.PROCESSING},
          locked_at = ${now},
          attempt_count = outbox.attempt_count + 1,
          updated_at = ${now}
      FROM picked
      WHERE outbox.id = picked.id
      RETURNING
        outbox.id,
        outbox.event_type AS "eventType",
        outbox.payload,
        outbox.status,
        outbox.attempt_count AS "attemptCount",
        outbox.locked_at AS "lockedAt",
        outbox.created_at AS "createdAt"
    `);

    return (result.rows as PublicCacheOutboxEvent[]).map((row) => ({
      ...row,
      lockedAt: new Date(row.lockedAt),
      createdAt: new Date(row.createdAt),
    }));
  });
}

export async function markPublicCacheOutboxEventCompleted(
  event: Pick<PublicCacheOutboxEvent, "id" | "attemptCount" | "lockedAt">,
  now: Date = new Date(),
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .update(publicCacheOutbox)
    .set({
      status: PUBLIC_CACHE_OUTBOX_STATUS.COMPLETED,
      completedAt: now,
      lockedAt: null,
      lastError: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(publicCacheOutbox.id, event.id),
        eq(publicCacheOutbox.status, PUBLIC_CACHE_OUTBOX_STATUS.PROCESSING),
        eq(publicCacheOutbox.attemptCount, event.attemptCount),
        eq(publicCacheOutbox.lockedAt, event.lockedAt),
      ),
    );

  return result.rowCount === 1;
}

export async function markPublicCacheOutboxEventFailed(
  event: Pick<PublicCacheOutboxEvent, "id" | "attemptCount" | "lockedAt">,
  error: unknown,
  now: Date = new Date(),
): Promise<PublicCacheOutboxStatus | null> {
  const db = getDb();
  const lastError = serializeOutboxError(error);
  const dead = event.attemptCount >= PUBLIC_CACHE_OUTBOX_MAX_ATTEMPTS;
  const status = dead
    ? PUBLIC_CACHE_OUTBOX_STATUS.DEAD
    : PUBLIC_CACHE_OUTBOX_STATUS.PENDING;
  const nextAttemptAt = dead
    ? now
    : new Date(now.getTime() + retryDelayMs(event.attemptCount));

  const result = await db
    .update(publicCacheOutbox)
    .set({
      status,
      lockedAt: null,
      lastError,
      nextAttemptAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(publicCacheOutbox.id, event.id),
        eq(publicCacheOutbox.status, PUBLIC_CACHE_OUTBOX_STATUS.PROCESSING),
        eq(publicCacheOutbox.attemptCount, event.attemptCount),
        eq(publicCacheOutbox.lockedAt, event.lockedAt),
      ),
    );

  if (result.rowCount !== 1) {
    return null;
  }

  return status;
}

export async function countPublicCacheOutboxEventsByStatus(): Promise<
  Record<PublicCacheOutboxStatus, number>
> {
  const db = getDb();
  const rows = await db
    .select({
      status: publicCacheOutbox.status,
      count: sql<number>`count(*)::int`,
    })
    .from(publicCacheOutbox)
    .groupBy(publicCacheOutbox.status);

  return {
    PENDING: 0,
    PROCESSING: 0,
    COMPLETED: 0,
    DEAD: 0,
    ...Object.fromEntries(rows.map((row) => [row.status, row.count])),
  };
}

function retryDelayMs(attemptCount: number): number {
  const secondsByAttempt = [60, 300, 900, 3600, 10_800] as const;
  return (
    secondsByAttempt[Math.min(attemptCount - 1, secondsByAttempt.length - 1)] *
    1000
  );
}

function serializeOutboxError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, PUBLIC_CACHE_OUTBOX_ERROR_MAX_LENGTH);
}
