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

export type PublicArticleCacheInvalidatePayload = {
  schemaVersion: 1;
  contentItemId: string;
  slug: string;
};

export type PublicEntityCacheInvalidatePayload = {
  schemaVersion: 1;
  entityId: string;
  slug: string;
};

export type PublicCacheOutboxPayload =
  | PublicArticleCacheInvalidatePayload
  | PublicEntityCacheInvalidatePayload;

export const publicCacheOutbox = pgTable(
  "public_cache_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<PublicCacheOutboxPayload>().notNull(),
    status: text("status").notNull().default("PENDING"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "public_cache_outbox_event_type_check",
      sql`${table.eventType} IN ('PUBLIC_ARTICLE_CACHE_INVALIDATE', 'PUBLIC_ENTITY_CACHE_INVALIDATE', 'PUBLIC_ENTITY_RELATED_CACHE_INVALIDATE')`,
    ),
    check(
      "public_cache_outbox_status_check",
      sql`${table.status} IN ('PENDING', 'PROCESSING', 'COMPLETED', 'DEAD')`,
    ),
    check(
      "public_cache_outbox_attempt_count_non_negative",
      sql`${table.attemptCount} >= 0`,
    ),
    index("public_cache_outbox_poll_idx").on(
      table.status,
      table.nextAttemptAt,
      table.createdAt,
      table.id,
    ),
  ],
);
