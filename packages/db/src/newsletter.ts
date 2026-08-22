import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import {
  CAPABILITY,
  NEWSLETTER_CONFIRMATION_TOKEN_TTL_MS,
  NEWSLETTER_CONSENT_EVENT_TYPE,
  NEWSLETTER_ERROR,
  NEWSLETTER_SUBSCRIPTION_STATUS,
  NEWSLETTER_SUPPRESSION_REASON,
  NEWSLETTER_TOKEN_BYTES_REQUIRED,
  NEWSLETTER_UNSUBSCRIBE_TOKEN_TTL_MS,
  NewsletterError,
  assertNewsletterTokenEntropy,
  decideNewsletterAdminSuppression,
  decideNewsletterConfirmation,
  decideNewsletterSignup,
  decideNewsletterUnsubscribe,
  isNewsletterRecipientEligible,
  normalizeNewsletterEmail,
  type NewsletterConsentEventType,
  type NewsletterSubscriptionStatus,
  type NewsletterSuppressionReason,
  type StaffRole,
  hasCapability,
} from "@magazine/domain";
import { getDb } from "./client";
import { newsletterConsentEvents, newsletterSubscribers } from "./schema/newsletter";

export type NewsletterActor = {
  staffUserId: string;
  roles: readonly StaffRole[];
};

export type NewsletterSignupResult = {
  status: "ACCEPTED";
  confirmationToken: string | null;
  unsubscribeToken: string | null;
  confirmationRequested: boolean;
};

export type NewsletterConfirmResult =
  | { status: "CONFIRMED" }
  | { status: "INVALID_OR_EXPIRED" };

export type NewsletterUnsubscribeResult =
  | { status: "SUCCESS" }
  | { status: "ALREADY_UNSUBSCRIBED" }
  | { status: "INVALID_OR_EXPIRED" };

export type NewsletterSubscriberListInput = {
  actor: NewsletterActor;
  search?: string | null;
  status?: NewsletterSubscriptionStatus | null;
  suppressed?: boolean | null;
  cursor?: string | null;
  limit?: number;
};

export type NewsletterSubscriberProjection = {
  id: string;
  email: string;
  status: NewsletterSubscriptionStatus;
  suppressed: boolean;
  suppressionReason: NewsletterSuppressionReason | null;
  source: string;
  consentVersion: string | null;
  surface: string | null;
  createdAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  updatedAt: string;
};

export type NewsletterSubscriberListResult = {
  items: NewsletterSubscriberProjection[];
  nextCursor: string | null;
};

export type NewsletterRecipientBatchResult = {
  items: { id: string; email: string }[];
  nextCursor: string | null;
};

type SubscriberRow = typeof newsletterSubscribers.$inferSelect;
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

const LIST_DEFAULT_LIMIT = 25;
const LIST_MAX_LIMIT = 100;
const RECIPIENT_BATCH_DEFAULT_LIMIT = 100;
const RECIPIENT_BATCH_MAX_LIMIT = 500;

export async function requestNewsletterSignup(input: {
  email: unknown;
  source?: unknown;
  consentVersion?: unknown;
  surface?: unknown;
  now?: Date;
}): Promise<NewsletterSignupResult> {
  const now = input.now ?? new Date();
  const normalized = normalizeNewsletterEmail(input.email);
  if (!normalized.ok) {
    throw new NewsletterError(normalized.code);
  }
  const token = generateNewsletterToken();
  const unsubscribeToken = generateNewsletterToken();
  const confirmationTokenHash = hashNewsletterToken(token);
  const unsubscribeTokenHash = hashNewsletterToken(unsubscribeToken);

  return getDb().transaction(async (tx) => {
    const current = await findSubscriberForUpdate(tx, normalized.value);
    const plan = decideNewsletterSignup({
      email: normalized.value,
      current: current
        ? {
            status: current.status as NewsletterSubscriptionStatus,
            suppressed: current.suppressed,
            suppressionReason: current.suppressionReason as NewsletterSuppressionReason | null,
          }
        : null,
      source: input.source,
      consentVersion: input.consentVersion,
      surface: input.surface,
      now,
    });

    if (current?.status === NEWSLETTER_SUBSCRIPTION_STATUS.ACTIVE && !current.suppressed) {
      await appendConsentEvent(tx, current, {
        eventType: NEWSLETTER_CONSENT_EVENT_TYPE.SUBSCRIBE_REQUESTED,
        occurredAt: now,
        source: plan.source,
        consentVersion: plan.consentVersion,
        surface: plan.surface,
        changeSet: { duplicateActiveRequest: true },
      });
      return {
        status: "ACCEPTED",
        confirmationToken: null,
        unsubscribeToken: null,
        confirmationRequested: false,
      };
    }

    const confirmationTokenExpiresAt = new Date(
      now.getTime() + NEWSLETTER_CONFIRMATION_TOKEN_TTL_MS,
    );
    const unsubscribeTokenExpiresAt = new Date(
      now.getTime() + NEWSLETTER_UNSUBSCRIBE_TOKEN_TTL_MS,
    );
    const suppressed = current?.status === NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED;
    const suppressionReason = suppressed ? NEWSLETTER_SUPPRESSION_REASON.UNSUBSCRIBED : null;

    const [subscriber] = current
      ? await tx
          .update(newsletterSubscribers)
          .set({
            status: NEWSLETTER_SUBSCRIPTION_STATUS.PENDING,
            suppressed,
            suppressionReason,
            source: plan.source,
            consentVersion: plan.consentVersion,
            surface: plan.surface,
            confirmationTokenHash,
            confirmationTokenExpiresAt,
            confirmationTokenConsumedAt: null,
            unsubscribeTokenHash,
            unsubscribeTokenExpiresAt,
            updatedAt: now,
          })
          .where(eq(newsletterSubscribers.id, current.id))
          .returning()
      : await tx
          .insert(newsletterSubscribers)
          .values({
            email: plan.email,
            status: NEWSLETTER_SUBSCRIPTION_STATUS.PENDING,
            suppressed: false,
            suppressionReason: null,
            source: plan.source,
            consentVersion: plan.consentVersion,
            surface: plan.surface,
            confirmationTokenHash,
            confirmationTokenExpiresAt,
            confirmationTokenConsumedAt: null,
            unsubscribeTokenHash,
            unsubscribeTokenExpiresAt,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
    if (!subscriber) {
      throw new NewsletterError(NEWSLETTER_ERROR.INVALID_INPUT);
    }
    await appendConsentEvent(tx, subscriber, {
      eventType: plan.eventType,
      occurredAt: now,
      source: plan.source,
      consentVersion: plan.consentVersion,
      surface: plan.surface,
      changeSet: { status: NEWSLETTER_SUBSCRIPTION_STATUS.PENDING },
    });
    return {
      status: "ACCEPTED",
      confirmationToken: token,
      unsubscribeToken,
      confirmationRequested: true,
    };
  });
}

export async function confirmNewsletterSubscription(input: {
  token: string;
  now?: Date;
}): Promise<NewsletterConfirmResult> {
  const now = input.now ?? new Date();
  const tokenHash = hashNewsletterTokenString(input.token);
  if (!tokenHash) {
    return { status: "INVALID_OR_EXPIRED" };
  }
  return getDb().transaction(async (tx) => {
    const row = await findSubscriberByConfirmationHashForUpdate(tx, tokenHash);
    if (!row || !row.confirmationTokenExpiresAt) {
      return { status: "INVALID_OR_EXPIRED" };
    }
    const decision = decideNewsletterConfirmation({
      tokenExpiresAt: row.confirmationTokenExpiresAt,
      tokenConsumedAt: row.confirmationTokenConsumedAt,
      subscriberStatus: row.status as NewsletterSubscriptionStatus,
      suppressed: row.suppressed,
      suppressionReason: row.suppressionReason as NewsletterSuppressionReason | null,
      now,
    });
    if (!decision.ok) {
      return { status: "INVALID_OR_EXPIRED" };
    }
    const [updated] = await tx
      .update(newsletterSubscribers)
      .set({
        status: NEWSLETTER_SUBSCRIPTION_STATUS.ACTIVE,
        suppressed: false,
        suppressionReason: null,
        confirmationTokenHash: null,
        confirmationTokenExpiresAt: null,
        confirmationTokenConsumedAt: now,
        confirmedAt: now,
        updatedAt: now,
      })
      .where(eq(newsletterSubscribers.id, row.id))
      .returning();
    if (!updated) {
      return { status: "INVALID_OR_EXPIRED" };
    }
    await appendConsentEvent(tx, updated, {
      eventType: NEWSLETTER_CONSENT_EVENT_TYPE.CONFIRMED,
      occurredAt: now,
      source: updated.source,
      consentVersion: updated.consentVersion,
      surface: updated.surface,
      changeSet: { status: NEWSLETTER_SUBSCRIPTION_STATUS.ACTIVE },
    });
    return { status: "CONFIRMED" };
  });
}

export async function unsubscribeNewsletter(input: {
  token: string;
  now?: Date;
}): Promise<NewsletterUnsubscribeResult> {
  const now = input.now ?? new Date();
  const tokenHash = hashNewsletterTokenString(input.token);
  if (!tokenHash) {
    return { status: "INVALID_OR_EXPIRED" };
  }
  return getDb().transaction(async (tx) => {
    const row = await findSubscriberByUnsubscribeHashForUpdate(tx, tokenHash);
    if (!row) {
      return { status: "INVALID_OR_EXPIRED" };
    }
    const decision = decideNewsletterUnsubscribe({
      tokenExpiresAt: row.unsubscribeTokenExpiresAt,
      tokenConsumedAt:
        row.status === NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED
          ? row.unsubscribedAt
          : null,
      subscriberStatus: row.status as NewsletterSubscriptionStatus,
      now,
    });
    if (decision.result === "INVALID_OR_EXPIRED") {
      return { status: "INVALID_OR_EXPIRED" };
    }
    if (decision.result === "ALREADY_UNSUBSCRIBED") {
      return { status: "ALREADY_UNSUBSCRIBED" };
    }
    const [updated] = await tx
      .update(newsletterSubscribers)
      .set({
        status: NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED,
        suppressed: true,
        suppressionReason: NEWSLETTER_SUPPRESSION_REASON.UNSUBSCRIBED,
        unsubscribedAt: now,
        updatedAt: now,
      })
      .where(eq(newsletterSubscribers.id, row.id))
      .returning();
    if (!updated) {
      return { status: "INVALID_OR_EXPIRED" };
    }
    await appendConsentEvent(tx, updated, {
      eventType: NEWSLETTER_CONSENT_EVENT_TYPE.UNSUBSCRIBED,
      occurredAt: now,
      source: updated.source,
      consentVersion: updated.consentVersion,
      surface: updated.surface,
      changeSet: {
        status: NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED,
        suppressionReason: NEWSLETTER_SUPPRESSION_REASON.UNSUBSCRIBED,
      },
    });
    return { status: "SUCCESS" };
  });
}

export async function listNewsletterSubscribers(
  input: NewsletterSubscriberListInput,
): Promise<NewsletterSubscriberListResult> {
  authorizeNewsletterAdmin(input.actor);
  const limit = clampLimit(input.limit, LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT);
  const cursor = decodeCursor(input.cursor);
  const clauses = [];
  if (input.status) {
    clauses.push(eq(newsletterSubscribers.status, input.status));
  }
  if (input.suppressed !== null && input.suppressed !== undefined) {
    clauses.push(eq(newsletterSubscribers.suppressed, input.suppressed));
  }
  const search = input.search?.trim();
  if (search) {
    clauses.push(ilike(newsletterSubscribers.email, `%${escapeLike(search)}%`));
  }
  if (cursor) {
    clauses.push(
      or(
        lt(newsletterSubscribers.createdAt, cursor.createdAt),
        and(
          eq(newsletterSubscribers.createdAt, cursor.createdAt),
          lt(newsletterSubscribers.id, cursor.id),
        ),
      ),
    );
  }

  const rows = await getDb()
    .select(adminProjection)
    .from(newsletterSubscribers)
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(desc(newsletterSubscribers.createdAt), desc(newsletterSubscribers.id))
    .limit(limit + 1);
  const items = rows.slice(0, limit).map(projectSubscriber);
  const last = rows.length > limit ? rows[limit - 1] : null;
  return { items, nextCursor: last ? encodeCursor(last.createdAt, last.id) : null };
}

export async function suppressNewsletterSubscriber(input: {
  actor: NewsletterActor;
  subscriberId: string;
  note?: unknown;
  now?: Date;
}): Promise<NewsletterSubscriberProjection> {
  const plan = decideNewsletterAdminSuppression({
    roles: input.actor.roles,
    note: input.note,
    now: input.now ?? new Date(),
  });
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select(subscriberProjection)
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.id, input.subscriberId))
      .for("update");
    if (!row) {
      throw new NewsletterError(NEWSLETTER_ERROR.INVALID_INPUT);
    }
    const [updated] = await tx
      .update(newsletterSubscribers)
      .set({
        suppressed: plan.suppressed,
        suppressionReason: plan.suppressionReason,
        updatedAt: plan.now,
      })
      .where(eq(newsletterSubscribers.id, row.id))
      .returning();
    if (!updated) {
      throw new NewsletterError(NEWSLETTER_ERROR.INVALID_INPUT);
    }
    await appendConsentEvent(tx, updated, {
      eventType: plan.eventType,
      occurredAt: plan.now,
      actorKind: "STAFF",
      actorStaffUserId: input.actor.staffUserId,
      source: updated.source,
      consentVersion: updated.consentVersion,
      surface: updated.surface,
      changeSet: { suppressionReason: plan.suppressionReason, note: plan.note },
    });
    return projectSubscriber(updated);
  });
}

export async function listEligibleNewsletterRecipients(input: {
  cursor?: string | null;
  limit?: number;
} = {}): Promise<NewsletterRecipientBatchResult> {
  const limit = clampLimit(
    input.limit,
    RECIPIENT_BATCH_DEFAULT_LIMIT,
    RECIPIENT_BATCH_MAX_LIMIT,
  );
  const cursor = decodeCursor(input.cursor);
  const clauses = [
    eq(newsletterSubscribers.status, NEWSLETTER_SUBSCRIPTION_STATUS.ACTIVE),
    eq(newsletterSubscribers.suppressed, false),
    sql`${newsletterSubscribers.suppressionReason} IS NULL`,
  ];
  if (cursor) {
    clauses.push(
      or(
        sql`${newsletterSubscribers.createdAt} > ${cursor.createdAt}`,
        and(
          eq(newsletterSubscribers.createdAt, cursor.createdAt),
          sql`${newsletterSubscribers.id} > ${cursor.id}`,
        ),
      )!,
    );
  }
  const rows = await getDb()
    .select({
      id: newsletterSubscribers.id,
      email: newsletterSubscribers.email,
      status: newsletterSubscribers.status,
      suppressed: newsletterSubscribers.suppressed,
      suppressionReason: newsletterSubscribers.suppressionReason,
      createdAt: newsletterSubscribers.createdAt,
    })
    .from(newsletterSubscribers)
    .where(and(...clauses))
    .orderBy(asc(newsletterSubscribers.createdAt), asc(newsletterSubscribers.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = rows.length > limit ? rows[limit - 1] : null;
  return {
    items: page.filter(isEligibleRow).map((row) => ({ id: row.id, email: row.email })),
    nextCursor: last ? encodeCursor(last.createdAt, last.id) : null,
  };
}

export function hashNewsletterTokenString(token: string): string | null {
  if (typeof token !== "string" || token.length < 32 || token.length > 256) {
    return null;
  }
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function generateNewsletterToken(): string {
  const bytes = randomBytes(NEWSLETTER_TOKEN_BYTES_REQUIRED);
  assertNewsletterTokenEntropy(bytes);
  return bytes.toString("base64url");
}

function hashNewsletterToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function findSubscriberForUpdate(
  tx: Tx,
  email: string,
): Promise<SubscriberRow | null> {
  const [row] = await tx
    .select(subscriberProjection)
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .for("update");
  return row ?? null;
}

async function findSubscriberByConfirmationHashForUpdate(
  tx: Tx,
  tokenHash: string,
): Promise<SubscriberRow | null> {
  const [row] = await tx
    .select(subscriberProjection)
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.confirmationTokenHash, tokenHash))
    .for("update");
  return row ?? null;
}

async function findSubscriberByUnsubscribeHashForUpdate(
  tx: Tx,
  tokenHash: string,
): Promise<SubscriberRow | null> {
  const [row] = await tx
    .select(subscriberProjection)
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.unsubscribeTokenHash, tokenHash))
    .for("update");
  return row ?? null;
}

async function appendConsentEvent(
  tx: Tx,
  subscriber: SubscriberRow,
  input: {
    eventType: NewsletterConsentEventType;
    occurredAt: Date;
    actorKind?: "PUBLIC" | "STAFF" | "SYSTEM";
    actorStaffUserId?: string | null;
    source: string;
    consentVersion: string | null;
    surface: string | null;
    changeSet: Record<string, unknown>;
  },
): Promise<void> {
  await tx.insert(newsletterConsentEvents).values({
    subscriberId: subscriber.id,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    actorKind: input.actorKind ?? "PUBLIC",
    actorStaffUserId: input.actorStaffUserId ?? null,
    email: subscriber.email,
    source: input.source,
    consentVersion: input.consentVersion,
    surface: input.surface,
    changeSet: input.changeSet,
  });
}

const adminProjection = {
  id: newsletterSubscribers.id,
  email: newsletterSubscribers.email,
  status: newsletterSubscribers.status,
  suppressed: newsletterSubscribers.suppressed,
  suppressionReason: newsletterSubscribers.suppressionReason,
  source: newsletterSubscribers.source,
  consentVersion: newsletterSubscribers.consentVersion,
  surface: newsletterSubscribers.surface,
  createdAt: newsletterSubscribers.createdAt,
  confirmedAt: newsletterSubscribers.confirmedAt,
  unsubscribedAt: newsletterSubscribers.unsubscribedAt,
  updatedAt: newsletterSubscribers.updatedAt,
};

const subscriberProjection = {
  ...adminProjection,
  confirmationTokenHash: newsletterSubscribers.confirmationTokenHash,
  confirmationTokenExpiresAt: newsletterSubscribers.confirmationTokenExpiresAt,
  confirmationTokenConsumedAt: newsletterSubscribers.confirmationTokenConsumedAt,
  unsubscribeTokenHash: newsletterSubscribers.unsubscribeTokenHash,
  unsubscribeTokenExpiresAt: newsletterSubscribers.unsubscribeTokenExpiresAt,
};

function projectSubscriber(row: {
  id: string;
  email: string;
  status: string;
  suppressed: boolean;
  suppressionReason: string | null;
  source: string;
  consentVersion: string | null;
  surface: string | null;
  createdAt: Date | string;
  confirmedAt: Date | string | null;
  unsubscribedAt: Date | string | null;
  updatedAt: Date | string;
}): NewsletterSubscriberProjection {
  return {
    id: row.id,
    email: row.email,
    status: row.status as NewsletterSubscriptionStatus,
    suppressed: row.suppressed,
    suppressionReason: row.suppressionReason as NewsletterSuppressionReason | null,
    source: row.source,
    consentVersion: row.consentVersion,
    surface: row.surface,
    createdAt: iso(row.createdAt),
    confirmedAt: row.confirmedAt ? iso(row.confirmedAt) : null,
    unsubscribedAt: row.unsubscribedAt ? iso(row.unsubscribedAt) : null,
    updatedAt: iso(row.updatedAt),
  };
}

function isEligibleRow(row: {
  status: string;
  suppressed: boolean;
  suppressionReason: string | null;
}): boolean {
  return isNewsletterRecipientEligible({
    status: row.status as NewsletterSubscriptionStatus,
    suppressed: row.suppressed,
    suppressionReason: row.suppressionReason as NewsletterSuppressionReason | null,
  });
}

function authorizeNewsletterAdmin(actor: NewsletterActor): void {
  if (!hasCapability(actor.roles, CAPABILITY.CONTENT_PUBLISH)) {
    throw new NewsletterError(NEWSLETTER_ERROR.FORBIDDEN);
  }
}

function clampLimit(limit: number | undefined, defaultLimit: number, maxLimit: number): number {
  if (!Number.isFinite(limit)) {
    return defaultLimit;
  }
  return Math.max(1, Math.min(maxLimit, Math.floor(limit as number)));
}

function escapeLike(value: string): string {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function encodeCursor(createdAt: Date | string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: iso(createdAt), id })).toString("base64url");
}

function decodeCursor(
  value: string | null | undefined,
): { createdAt: Date; id: string } | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      return null;
    }
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
