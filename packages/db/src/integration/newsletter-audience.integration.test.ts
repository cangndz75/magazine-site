import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import {
  NEWSLETTER_CONSENT_EVENT_TYPE,
  NEWSLETTER_ERROR,
  NEWSLETTER_SUBSCRIPTION_STATUS,
  NEWSLETTER_SUPPRESSION_REASON,
  NewsletterError,
  STAFF_ROLE,
  STAFF_SCOPE_MODE,
  STAFF_STATUS,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  confirmNewsletterSubscription,
  hashNewsletterTokenString,
  listEligibleNewsletterRecipients,
  listNewsletterSubscribers,
  requestNewsletterSignup,
  suppressNewsletterSubscriber,
  unsubscribeNewsletter,
  type NewsletterActor,
} from "../newsletter";
import {
  newsletterConsentEvents,
  newsletterSubscribers,
  staffUsers,
} from "../schema";
import {
  cleanupStaffAuthTables,
  closeIntegrationConnections,
  ensureEditorContentTestDatabase,
} from "./harness";

function assertNewsletterCode(error: unknown, code: string): boolean {
  assert.equal(error instanceof NewsletterError, true, String(error));
  assert.equal((error as NewsletterError).code, code);
  return true;
}

describe("newsletter audience PostgreSQL foundation", () => {
  let actor: NewsletterActor;

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    await cleanupNewsletter();
    await cleanupStaffAuthTables();
    const staffUserId = randomUUID();
    await getDb().insert(staffUsers).values({
      id: staffUserId,
      email: `newsletter-${staffUserId}@example.test`,
      displayName: "Newsletter Publisher",
      status: STAFF_STATUS.ACTIVE,
      scopeMode: STAFF_SCOPE_MODE.ALL,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    actor = { staffUserId, roles: [STAFF_ROLE.SUPER_ADMIN] };
  });

  afterEach(async () => {
    await cleanupNewsletter();
    await cleanupStaffAuthTables();
  });

  after(async () => {
    await closeIntegrationConnections();
  });

  it("deduplicates signup, stores token hashes only, confirms, and lists safe DTOs", async () => {
    const first = await requestNewsletterSignup({
      email: " Person@Example.COM ",
      source: "footer",
      consentVersion: "v1",
      surface: "homepage-footer",
      now: new Date("2026-08-23T10:00:00.000Z"),
    });
    assert.equal(first.status, "ACCEPTED");
    assert.equal(first.confirmationRequested, true);
    assert.notEqual(first.confirmationToken, null);
    assert.notEqual(first.unsubscribeToken, null);

    const duplicate = await requestNewsletterSignup({
      email: "person@example.com",
      source: "footer",
      now: new Date("2026-08-23T10:01:00.000Z"),
    });
    assert.equal(duplicate.confirmationRequested, true);

    const rows = await getDb()
      .select({
        email: newsletterSubscribers.email,
        status: newsletterSubscribers.status,
        confirmationTokenHash: newsletterSubscribers.confirmationTokenHash,
        unsubscribeTokenHash: newsletterSubscribers.unsubscribeTokenHash,
      })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, "person@example.com"));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, NEWSLETTER_SUBSCRIPTION_STATUS.PENDING);
    assert.notEqual(rows[0]?.confirmationTokenHash, duplicate.confirmationToken);
    assert.notEqual(rows[0]?.unsubscribeTokenHash, duplicate.unsubscribeToken);
    assert.equal(rows[0]?.confirmationTokenHash, hashNewsletterTokenString(duplicate.confirmationToken!));

    assert.deepEqual(await confirmNewsletterSubscription({ token: duplicate.confirmationToken! }), {
      status: "CONFIRMED",
    });
    assert.deepEqual(await confirmNewsletterSubscription({ token: duplicate.confirmationToken! }), {
      status: "INVALID_OR_EXPIRED",
    });

    const list = await listNewsletterSubscribers({ actor, search: "PERSON@", limit: 1 });
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0]?.email, "person@example.com");
    assert.equal("confirmationTokenHash" in list.items[0]!, false);

    const events = await getDb()
      .select({ eventType: newsletterConsentEvents.eventType })
      .from(newsletterConsentEvents)
      .where(eq(newsletterConsentEvents.email, "person@example.com"));
    assert.equal(
      events.some((event) => event.eventType === NEWSLETTER_CONSENT_EVENT_TYPE.CONFIRMED),
      true,
    );
  });

  it("unsubscribes idempotently and requires fresh confirmation before resubscribe eligibility", async () => {
    const signup = await requestNewsletterSignup({ email: "resub@example.com" });
    await confirmNewsletterSubscription({ token: signup.confirmationToken! });
    assert.equal((await listEligibleNewsletterRecipients({ limit: 10 })).items.length, 1);

    assert.deepEqual(await unsubscribeNewsletter({ token: signup.unsubscribeToken! }), {
      status: "SUCCESS",
    });
    assert.deepEqual(await unsubscribeNewsletter({ token: signup.unsubscribeToken! }), {
      status: "ALREADY_UNSUBSCRIBED",
    });
    assert.equal((await listEligibleNewsletterRecipients({ limit: 10 })).items.length, 0);

    const resubscribe = await requestNewsletterSignup({ email: "RESUB@example.com" });
    assert.equal(resubscribe.confirmationRequested, true);
    assert.equal((await listEligibleNewsletterRecipients({ limit: 10 })).items.length, 0);
    await confirmNewsletterSubscription({ token: resubscribe.confirmationToken! });
    assert.equal((await listEligibleNewsletterRecipients({ limit: 10 })).items.length, 1);
  });

  it("enforces suppression and admin cannot fabricate consent", async () => {
    const signup = await requestNewsletterSignup({ email: "blocked@example.com" });
    await confirmNewsletterSubscription({ token: signup.confirmationToken! });
    const list = await listNewsletterSubscribers({ actor, search: "blocked", limit: 10 });
    const subscriber = list.items[0]!;

    await assert.rejects(
      suppressNewsletterSubscriber({
        actor: { staffUserId: actor.staffUserId, roles: [STAFF_ROLE.AUTHOR] },
        subscriberId: subscriber.id,
      }),
      (error) => assertNewsletterCode(error, NEWSLETTER_ERROR.FORBIDDEN),
    );

    const suppressed = await suppressNewsletterSubscriber({
      actor,
      subscriberId: subscriber.id,
      note: "manual block",
    });
    assert.equal(suppressed.suppressed, true);
    assert.equal(suppressed.suppressionReason, NEWSLETTER_SUPPRESSION_REASON.ADMIN_BLOCK);
    assert.equal((await listEligibleNewsletterRecipients({ limit: 10 })).items.length, 0);

    const events = await getDb()
      .select({ eventType: newsletterConsentEvents.eventType })
      .from(newsletterConsentEvents)
      .where(eq(newsletterConsentEvents.subscriberId, subscriber.id));
    assert.equal(
      events.some((event) => event.eventType === NEWSLETTER_CONSENT_EVENT_TYPE.ADMIN_SUPPRESSED),
      true,
    );
  });

  it("rejects expired confirmation tokens and keeps admin listing bounded", async () => {
    const signup = await requestNewsletterSignup({
      email: "expired@example.com",
      now: new Date("2026-08-23T10:00:00.000Z"),
    });
    assert.deepEqual(
      await confirmNewsletterSubscription({
        token: signup.confirmationToken!,
        now: new Date("2026-08-25T10:00:00.000Z"),
      }),
      { status: "INVALID_OR_EXPIRED" },
    );
    const list = await listNewsletterSubscribers({ actor, limit: 1 });
    assert.equal(list.items.length, 1);
  });
});

async function cleanupNewsletter(): Promise<void> {
  await getDb().delete(newsletterConsentEvents);
  await getDb().delete(newsletterSubscribers);
}
