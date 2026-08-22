import { hasCapability } from "./authorization";
import { CAPABILITY } from "./capability";
import type { StaffRole } from "./staff-role";

export const NEWSLETTER_SUBSCRIPTION_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  UNSUBSCRIBED: "UNSUBSCRIBED",
} as const;

export type NewsletterSubscriptionStatus =
  (typeof NEWSLETTER_SUBSCRIPTION_STATUS)[keyof typeof NEWSLETTER_SUBSCRIPTION_STATUS];

export const NEWSLETTER_SUPPRESSION_REASON = {
  UNSUBSCRIBED: "UNSUBSCRIBED",
  HARD_BOUNCE: "HARD_BOUNCE",
  COMPLAINT: "COMPLAINT",
  ADMIN_BLOCK: "ADMIN_BLOCK",
} as const;

export type NewsletterSuppressionReason =
  (typeof NEWSLETTER_SUPPRESSION_REASON)[keyof typeof NEWSLETTER_SUPPRESSION_REASON];

export const NEWSLETTER_CONSENT_EVENT_TYPE = {
  SUBSCRIBE_REQUESTED: "SUBSCRIBE_REQUESTED",
  CONFIRMED: "CONFIRMED",
  UNSUBSCRIBED: "UNSUBSCRIBED",
  RESUBSCRIBE_REQUESTED: "RESUBSCRIBE_REQUESTED",
  ADMIN_SUPPRESSED: "ADMIN_SUPPRESSED",
} as const;

export type NewsletterConsentEventType =
  (typeof NEWSLETTER_CONSENT_EVENT_TYPE)[keyof typeof NEWSLETTER_CONSENT_EVENT_TYPE];

export const NEWSLETTER_ERROR = {
  INVALID_EMAIL: "INVALID_EMAIL",
  INVALID_INPUT: "INVALID_INPUT",
  TOKEN_INVALID_OR_EXPIRED: "TOKEN_INVALID_OR_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  UNSAFE_AUDIT_PAYLOAD: "UNSAFE_AUDIT_PAYLOAD",
} as const;

export type NewsletterErrorCode =
  (typeof NEWSLETTER_ERROR)[keyof typeof NEWSLETTER_ERROR];

export class NewsletterError extends Error {
  readonly code: NewsletterErrorCode;

  constructor(code: NewsletterErrorCode, message = code) {
    super(message);
    this.name = "NewsletterError";
    this.code = code;
  }
}

export type NormalizedNewsletterEmail =
  | { ok: true; value: string }
  | { ok: false; code: typeof NEWSLETTER_ERROR.INVALID_EMAIL };

export type NewsletterSubscriberState = {
  status: NewsletterSubscriptionStatus;
  suppressed: boolean;
  suppressionReason: NewsletterSuppressionReason | null;
};

export type NewsletterSignupPlan = {
  email: string;
  status: typeof NEWSLETTER_SUBSCRIPTION_STATUS.PENDING;
  eventType:
    | typeof NEWSLETTER_CONSENT_EVENT_TYPE.SUBSCRIBE_REQUESTED
    | typeof NEWSLETTER_CONSENT_EVENT_TYPE.RESUBSCRIBE_REQUESTED;
  source: string;
  consentVersion: string | null;
  surface: string | null;
  now: Date;
};

export type NewsletterConfirmationDecision =
  | { ok: true; status: typeof NEWSLETTER_SUBSCRIPTION_STATUS.ACTIVE }
  | { ok: false; code: typeof NEWSLETTER_ERROR.TOKEN_INVALID_OR_EXPIRED };

export type NewsletterUnsubscribeDecision =
  | { result: "SUCCESS"; status: typeof NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED }
  | { result: "ALREADY_UNSUBSCRIBED"; status: typeof NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED }
  | { result: "INVALID_OR_EXPIRED" };

export type NewsletterAdminSuppressionPlan = {
  suppressed: true;
  suppressionReason: typeof NEWSLETTER_SUPPRESSION_REASON.ADMIN_BLOCK;
  eventType: typeof NEWSLETTER_CONSENT_EVENT_TYPE.ADMIN_SUPPRESSED;
  note: string | null;
  now: Date;
};

export const NEWSLETTER_EMAIL_MAX_LENGTH = 254;
const NEWSLETTER_TOKEN_BYTES = 32;
export const NEWSLETTER_TOKEN_BYTES_REQUIRED = NEWSLETTER_TOKEN_BYTES;
export const NEWSLETTER_CONFIRMATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;
export const NEWSLETTER_UNSUBSCRIBE_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 365 * 5;
export const NEWSLETTER_PUBLIC_RESPONSE_MESSAGE =
  "Abonelik islemi icin e-posta adresinizi kontrol edin.";

const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function normalizeNewsletterEmail(value: unknown): NormalizedNewsletterEmail {
  if (typeof value !== "string") {
    return { ok: false, code: NEWSLETTER_ERROR.INVALID_EMAIL };
  }
  const email = value.trim().toLowerCase();
  if (
    email.length === 0 ||
    email.length > NEWSLETTER_EMAIL_MAX_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    return { ok: false, code: NEWSLETTER_ERROR.INVALID_EMAIL };
  }
  return { ok: true, value: email };
}

export function assertNewsletterTokenEntropy(tokenBytes: Buffer): void {
  if (tokenBytes.byteLength !== NEWSLETTER_TOKEN_BYTES_REQUIRED) {
    throw new NewsletterError(NEWSLETTER_ERROR.INVALID_INPUT);
  }
}

export function decideNewsletterSignup(input: {
  email: unknown;
  current?: NewsletterSubscriberState | null;
  source?: unknown;
  consentVersion?: unknown;
  surface?: unknown;
  now: Date;
}): NewsletterSignupPlan {
  const email = normalizeNewsletterEmail(input.email);
  if (!email.ok) {
    throw new NewsletterError(email.code);
  }
  return {
    email: email.value,
    status: NEWSLETTER_SUBSCRIPTION_STATUS.PENDING,
    eventType:
      input.current?.status === NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED
        ? NEWSLETTER_CONSENT_EVENT_TYPE.RESUBSCRIBE_REQUESTED
        : NEWSLETTER_CONSENT_EVENT_TYPE.SUBSCRIBE_REQUESTED,
    source: boundedText(input.source, "PUBLIC_SIGNUP", 64),
    consentVersion: nullableBoundedText(input.consentVersion, 64),
    surface: nullableBoundedText(input.surface, 64),
    now: input.now,
  };
}

export function decideNewsletterConfirmation(input: {
  tokenExpiresAt: Date;
  tokenConsumedAt: Date | null;
  subscriberStatus: NewsletterSubscriptionStatus;
  suppressed: boolean;
  suppressionReason: NewsletterSuppressionReason | null;
  now: Date;
}): NewsletterConfirmationDecision {
  if (
    input.tokenConsumedAt !== null ||
    input.tokenExpiresAt.getTime() <= input.now.getTime()
  ) {
    return { ok: false, code: NEWSLETTER_ERROR.TOKEN_INVALID_OR_EXPIRED };
  }
  if (
    input.subscriberStatus === NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED ||
    (input.suppressed && input.suppressionReason !== NEWSLETTER_SUPPRESSION_REASON.UNSUBSCRIBED)
  ) {
    return { ok: false, code: NEWSLETTER_ERROR.TOKEN_INVALID_OR_EXPIRED };
  }
  return { ok: true, status: NEWSLETTER_SUBSCRIPTION_STATUS.ACTIVE };
}

export function decideNewsletterUnsubscribe(input: {
  tokenExpiresAt: Date;
  tokenConsumedAt: Date | null;
  subscriberStatus: NewsletterSubscriptionStatus;
  now: Date;
}): NewsletterUnsubscribeDecision {
  if (input.tokenExpiresAt.getTime() <= input.now.getTime()) {
    return { result: "INVALID_OR_EXPIRED" };
  }
  if (
    input.tokenConsumedAt !== null ||
    input.subscriberStatus === NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED
  ) {
    return {
      result: "ALREADY_UNSUBSCRIBED",
      status: NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED,
    };
  }
  return { result: "SUCCESS", status: NEWSLETTER_SUBSCRIPTION_STATUS.UNSUBSCRIBED };
}

export function decideNewsletterAdminSuppression(input: {
  roles: readonly StaffRole[];
  note?: unknown;
  now: Date;
}): NewsletterAdminSuppressionPlan {
  if (!hasCapability(input.roles, CAPABILITY.CONTENT_PUBLISH)) {
    throw new NewsletterError(NEWSLETTER_ERROR.FORBIDDEN);
  }
  const note = nullableBoundedText(input.note, 500);
  const changeSet = { suppressionReason: NEWSLETTER_SUPPRESSION_REASON.ADMIN_BLOCK, note };
  if (!newsletterAuditOmitsSecrets(changeSet)) {
    throw new NewsletterError(NEWSLETTER_ERROR.UNSAFE_AUDIT_PAYLOAD);
  }
  return {
    suppressed: true,
    suppressionReason: NEWSLETTER_SUPPRESSION_REASON.ADMIN_BLOCK,
    eventType: NEWSLETTER_CONSENT_EVENT_TYPE.ADMIN_SUPPRESSED,
    note,
    now: input.now,
  };
}

export function isNewsletterRecipientEligible(input: {
  status: NewsletterSubscriptionStatus;
  suppressed: boolean;
  suppressionReason: NewsletterSuppressionReason | null;
}): boolean {
  return (
    input.status === NEWSLETTER_SUBSCRIPTION_STATUS.ACTIVE &&
    input.suppressed === false &&
    input.suppressionReason === null
  );
}

export function newsletterSafePublicSignupResponse(): {
  status: "ACCEPTED";
  message: typeof NEWSLETTER_PUBLIC_RESPONSE_MESSAGE;
} {
  return { status: "ACCEPTED", message: NEWSLETTER_PUBLIC_RESPONSE_MESSAGE };
}

export function newsletterAuditOmitsSecrets(value: unknown): boolean {
  return !containsForbiddenKey(value);
}

function boundedText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : fallback;
}

function nullableBoundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
}

const FORBIDDEN_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "tokenDigest",
  "secret",
  "secretCiphertext",
  "databaseUrl",
  "connectionString",
]);

function containsForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(containsForbiddenKey);
  }
  return Object.entries(value).some(
    ([key, child]) => FORBIDDEN_KEYS.has(key) || containsForbiddenKey(child),
  );
}
