import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { staffUsers } from "./staff";

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    status: text("status").notNull().default("PENDING"),
    suppressed: boolean("suppressed").notNull().default(false),
    suppressionReason: text("suppression_reason"),
    source: text("source").notNull(),
    consentVersion: text("consent_version"),
    surface: text("surface"),
    confirmationTokenHash: text("confirmation_token_hash"),
    confirmationTokenExpiresAt: timestamp("confirmation_token_expires_at", {
      withTimezone: true,
    }),
    confirmationTokenConsumedAt: timestamp("confirmation_token_consumed_at", {
      withTimezone: true,
    }),
    unsubscribeTokenHash: text("unsubscribe_token_hash").notNull(),
    unsubscribeTokenExpiresAt: timestamp("unsubscribe_token_expires_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  },
  (table) => [
    unique("newsletter_subscribers_email_key").on(table.email),
    uniqueIndex("newsletter_subscribers_confirmation_token_hash_key")
      .on(table.confirmationTokenHash)
      .where(sql`${table.confirmationTokenHash} IS NOT NULL`),
    uniqueIndex("newsletter_subscribers_unsubscribe_token_hash_key").on(
      table.unsubscribeTokenHash,
    ),
    index("newsletter_subscribers_status_created_idx").on(
      table.status,
      table.createdAt,
      table.id,
    ),
    index("newsletter_subscribers_eligible_idx")
      .on(table.createdAt, table.id)
      .where(
        sql`${table.status} = 'ACTIVE' AND ${table.suppressed} = false AND ${table.suppressionReason} IS NULL`,
      ),
    check(
      "newsletter_subscribers_status_check",
      sql`${table.status} IN ('PENDING', 'ACTIVE', 'UNSUBSCRIBED')`,
    ),
  ],
);

export const newsletterConsentEvents = pgTable(
  "newsletter_consent_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriberId: uuid("subscriber_id").notNull(),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actorKind: text("actor_kind").notNull().default("PUBLIC"),
    actorStaffUserId: uuid("actor_staff_user_id"),
    email: text("email").notNull(),
    source: text("source").notNull(),
    consentVersion: text("consent_version"),
    surface: text("surface"),
    changeSet: jsonb("change_set").notNull(),
  },
  (table) => [
    index("newsletter_consent_events_subscriber_occurred_idx").on(
      table.subscriberId,
      table.occurredAt,
      table.id,
    ),
    foreignKey({
      name: "newsletter_consent_events_subscriber_fk",
      columns: [table.subscriberId],
      foreignColumns: [newsletterSubscribers.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "newsletter_consent_events_actor_staff_fk",
      columns: [table.actorStaffUserId],
      foreignColumns: [staffUsers.id],
    }).onDelete("restrict"),
  ],
);
