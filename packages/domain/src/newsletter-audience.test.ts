import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import {
  NEWSLETTER_CONSENT_EVENT_TYPE,
  NEWSLETTER_ERROR,
  NEWSLETTER_SUBSCRIPTION_STATUS,
  NEWSLETTER_SUPPRESSION_REASON,
  NEWSLETTER_TOKEN_BYTES_REQUIRED,
  NewsletterError,
  assertNewsletterTokenEntropy,
  decideNewsletterAdminSuppression,
  decideNewsletterConfirmation,
  decideNewsletterSignup,
  decideNewsletterUnsubscribe,
  isNewsletterRecipientEligible,
  newsletterAuditOmitsSecrets,
  newsletterSafePublicSignupResponse,
  normalizeNewsletterEmail,
} from "./newsletter-audience";
import { STAFF_ROLE } from "./staff-role";

function assertNewsletterCode(error: unknown, code: string): boolean {
  assert.equal(error instanceof NewsletterError, true, String(error));
  assert.equal((error as NewsletterError).code, code);
  return true;
}

describe("newsletter audience domain contract", () => {
  it("normalizes email once and rejects malformed addresses", () => {
    assert.deepEqual(normalizeNewsletterEmail("  PERSON@Example.COM "), {
      ok: true,
      value: "person@example.com",
    });
    for (const input of ["", "not-email", "a@b", "@example.com", "x".repeat(255) + "@e.com"]) {
      assert.equal(normalizeNewsletterEmail(input).ok, false, input);
    }
  });

  it("plans pending signup and requires fresh consent after unsubscribe", () => {
    const first = decideNewsletterSignup({
      email: "User@Example.com",
      source: "footer",
      surface: "public-footer",
      now: new Date("2026-08-23T10:00:00.000Z"),
    });
    assert.equal(first.email, "user@example.com");
    assert.equal(first.status, NEWSLETTER_SUBSCRIPTION_STATUS.PENDING);
    assert.equal(first.eventType, NEWSLETTER_CONSENT_EVENT_TYPE.SUBSCRIBE_REQUESTED);

    const resubscribe = decideNewsletterSignup({
      email: "user@example.com",
      current: {
        status: NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED,
        suppressed: true,
        suppressionReason: NEWSLETTER_SUPPRESSION_REASON.UNSUBSCRIBED,
      },
      now: new Date(),
    });
    assert.equal(resubscribe.eventType, NEWSLETTER_CONSENT_EVENT_TYPE.RESUBSCRIBE_REQUESTED);
  });

  it("keeps confirmation token one-time and expiring", () => {
    assert.doesNotThrow(() => assertNewsletterTokenEntropy(randomBytes(NEWSLETTER_TOKEN_BYTES_REQUIRED)));
    assert.throws(
      () => assertNewsletterTokenEntropy(randomBytes(8)),
      (error) => assertNewsletterCode(error, NEWSLETTER_ERROR.INVALID_INPUT),
    );

    const valid = decideNewsletterConfirmation({
      tokenExpiresAt: new Date("2026-08-24T10:00:00.000Z"),
      tokenConsumedAt: null,
      subscriberStatus: NEWSLETTER_SUBSCRIPTION_STATUS.PENDING,
      suppressed: false,
      suppressionReason: null,
      now: new Date("2026-08-23T10:00:00.000Z"),
    });
    assert.deepEqual(valid, { ok: true, status: NEWSLETTER_SUBSCRIPTION_STATUS.ACTIVE });

    const replay = decideNewsletterConfirmation({
      tokenExpiresAt: new Date("2026-08-24T10:00:00.000Z"),
      tokenConsumedAt: new Date("2026-08-23T10:00:00.000Z"),
      subscriberStatus: NEWSLETTER_SUBSCRIPTION_STATUS.PENDING,
      suppressed: false,
      suppressionReason: null,
      now: new Date("2026-08-23T10:01:00.000Z"),
    });
    assert.deepEqual(replay, { ok: false, code: NEWSLETTER_ERROR.TOKEN_INVALID_OR_EXPIRED });
  });

  it("makes unsubscribe idempotent and recipient eligibility centralized", () => {
    assert.deepEqual(
      decideNewsletterUnsubscribe({
        tokenExpiresAt: new Date("2027-08-23T10:00:00.000Z"),
        tokenConsumedAt: null,
        subscriberStatus: NEWSLETTER_SUBSCRIPTION_STATUS.ACTIVE,
        now: new Date("2026-08-23T10:00:00.000Z"),
      }),
      { result: "SUCCESS", status: NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED },
    );
    assert.deepEqual(
      decideNewsletterUnsubscribe({
        tokenExpiresAt: new Date("2027-08-23T10:00:00.000Z"),
        tokenConsumedAt: new Date("2026-08-23T10:00:00.000Z"),
        subscriberStatus: NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED,
        now: new Date("2026-08-23T10:01:00.000Z"),
      }),
      { result: "ALREADY_UNSUBSCRIBED", status: NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED },
    );
    assert.equal(
      isNewsletterRecipientEligible({
        status: NEWSLETTER_SUBSCRIPTION_STATUS.ACTIVE,
        suppressed: false,
        suppressionReason: null,
      }),
      true,
    );
    assert.equal(
      isNewsletterRecipientEligible({
        status: NEWSLETTER_SUBSCRIPTION_STATUS.ACTIVE,
        suppressed: true,
        suppressionReason: NEWSLETTER_SUPPRESSION_REASON.ADMIN_BLOCK,
      }),
      false,
    );
  });

  it("requires publish authority for admin suppression and keeps public DTO generic", () => {
    assert.throws(
      () => decideNewsletterAdminSuppression({ roles: [STAFF_ROLE.AUTHOR], now: new Date() }),
      (error) => assertNewsletterCode(error, NEWSLETTER_ERROR.FORBIDDEN),
    );
    const plan = decideNewsletterAdminSuppression({
      roles: [STAFF_ROLE.SUPER_ADMIN],
      note: "  do not contact  ",
      now: new Date(),
    });
    assert.equal(plan.suppressionReason, NEWSLETTER_SUPPRESSION_REASON.ADMIN_BLOCK);
    assert.equal(plan.note, "do not contact");
    assert.equal(newsletterAuditOmitsSecrets({ tokenHash: "hidden" }), false);
    assert.deepEqual(newsletterSafePublicSignupResponse(), {
      status: "ACCEPTED",
      message: "Abonelik islemi icin e-posta adresinizi kontrol edin.",
    });
  });
});
