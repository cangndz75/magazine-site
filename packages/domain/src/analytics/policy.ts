/**
 * Analytics measurement policy for taxonomy v1.
 *
 * These constants are the product contract. They are not a GDPR/KVKK
 * compliance claim, a traffic guarantee, or billable ad measurement.
 */

export const ANALYTICS_PRINCIPLES = {
  TAXONOMY_IS_VERSIONED:
    "Event taxonomy is versioned in the event contract, not only in documentation.",
  RAW_EVENTS_ARE_APPEND_ONLY:
    "Raw events are append-only facts. They are never updated in place.",
  AGGREGATES_ARE_DERIVED:
    "Dashboards and rollups are derived later from accepted raw events.",
  NOT_PUBLICATION_SOURCE_OF_TRUTH:
    "Analytics must never become the publication, slug, or legal source of truth.",
  FAIL_OPEN_FOR_PUBLIC_PAGES:
    "Analytics failures must never prevent normal public page rendering.",
  CLIENT_BUSINESS_IDENTITY_UNTRUSTED:
    "Client-provided content, author, category, revenue, and similar business identity is untrusted until server validation.",
  NO_STAFF_SECURITY_DATA:
    "Staff identity, auth tokens, MFA material, and editorial security data must never enter analytics events.",
  MINIMIZE_PERSONAL_DATA:
    "Public analytics stores the least identity needed for the chosen session model.",
  DISTINGUISH_NON_AUDIENCE_TRAFFIC:
    "Bot, internal, and test traffic must be distinguishable from audience traffic.",
  STABLE_EVENT_MEANING:
    "Event names cannot be reused for a different meaning. Breaking semantics require a new schema or event version.",
} as const;

export const ANALYTICS_TAXONOMY_VERSION = 1 as const;

export const ANALYTICS_DELIVERY_SEMANTICS = {
  DELIVERY: "AT_LEAST_ONCE",
  STORAGE_DEDUPE: "EVENT_ID",
  AGGREGATION: "MUST_NOT_DOUBLE_COUNT_DUPLICATE_EVENT_IDS",
  ORDERING: "NOT_GUARANTEED",
} as const;

export const ANALYTICS_EVENT_MAX_BYTES = 8192;

export const ANALYTICS_TIMESTAMP_POLICY = {
  FUTURE_SKEW_MS: 5 * 60 * 1000,
  MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Anonymous analytics session is a separate security domain from staff
 * editor sessions and MFA cookies.
 */
export const ANALYTICS_SESSION_POLICY = {
  INACTIVITY_TIMEOUT_MS: 30 * 60 * 1000,
  COOKIE_NAME: "magazine_analytics_session",
  IDENTITY_KIND: "ANONYMOUS_SESSION",
} as const;

/**
 * v1 does not issue a durable visitor identifier. Future UNIQUE_VISITORS
 * must not be described as unique people.
 */
export const ANALYTICS_VISITOR_POLICY = {
  DURABLE_VISITOR_ID_ENABLED: false,
  FINGERPRINTING_FORBIDDEN: true,
  IP_AS_VISITOR_ID_FORBIDDEN: true,
} as const;

export const ANALYTICS_CONSENT_STATE = {
  UNKNOWN: "UNKNOWN",
  GRANTED: "GRANTED",
  DENIED: "DENIED",
} as const;

export type AnalyticsConsentState =
  (typeof ANALYTICS_CONSENT_STATE)[keyof typeof ANALYTICS_CONSENT_STATE];

export const ANALYTICS_CONSENT_STATES = [
  ANALYTICS_CONSENT_STATE.UNKNOWN,
  ANALYTICS_CONSENT_STATE.GRANTED,
  ANALYTICS_CONSENT_STATE.DENIED,
] as const;

/**
 * No cookie banner exists in the product. Session identifiers are consent-gated.
 * Sessionless facts may still be accepted. This is a privacy-minimal baseline,
 * not a legal compliance certification.
 */
export const ANALYTICS_CONSENT_POLICY = {
  PERSISTENT_ID_REQUIRES: ANALYTICS_CONSENT_STATE.GRANTED,
  SESSIONLESS_EVENTS_ALLOWED_WITHOUT_GRANT: true,
  COOKIE_BANNER_IMPLEMENTED: false,
} as const;

export const ANALYTICS_IMPRESSION_POLICY = {
  MIN_VISIBLE_RATIO: 0.5,
  MIN_DWELL_MS: 250,
  DEDUPE: "ONCE_PER_PLACEMENT_PER_PAGE_VIEW_CONTEXT",
  SERVER_HTML_IS_NOT_PROOF_OF_VIEW: true,
} as const;

export const ANALYTICS_RETENTION_POLICY = {
  DEFAULT_RAW_DAYS: 90,
  MIN_RAW_DAYS: 7,
  MAX_RAW_DAYS: 730,
  DEFAULT_AGGREGATE_DAYS: 730,
  AGGREGATE_MAY_OUTLIVE_RAW: true,
  AGGREGATE_CLEANUP_JOB_IMPLEMENTED: false,
  LEGAL_PROMISE: false,
  CLEANUP_JOB_IMPLEMENTED: false,
  ENFORCEMENT: "ENFORCEMENT_PENDING",
} as const;

export const ANALYTICS_MEASUREMENT_CLASS = {
  EDITORIAL: "EDITORIAL",
  AD_BILLING: "AD_BILLING",
} as const;

export type AnalyticsMeasurementClass =
  (typeof ANALYTICS_MEASUREMENT_CLASS)[keyof typeof ANALYTICS_MEASUREMENT_CLASS];

/**
 * Editorial analytics must not automatically become invoice-grade ad records.
 */
export const ANALYTICS_ADS_BOUNDARY = {
  CURRENT_CLASS: ANALYTICS_MEASUREMENT_CLASS.EDITORIAL,
  BILLABLE_AD_MEASUREMENT: false,
  FRAUD_GRADE_INSUFFICIENT_FOR_INVOICING: true,
} as const;

export const ANALYTICS_ABUSE_THREAT = {
  EVENT_SPAM: "EVENT_SPAM",
  PAYLOAD_AMPLIFICATION: "PAYLOAD_AMPLIFICATION",
  FAKE_IMPRESSIONS_OR_CLICKS: "FAKE_IMPRESSIONS_OR_CLICKS",
  REPLAY: "REPLAY",
  OVERSIZED_REQUESTS: "OVERSIZED_REQUESTS",
  BOT_FLOODING: "BOT_FLOODING",
  ORIGIN_ABUSE: "ORIGIN_ABUSE",
  CSRF: "CSRF",
  RATE_LIMIT_EVASION: "RATE_LIMIT_EVASION",
  POISONED_REFERRERS: "POISONED_REFERRERS",
  IDENTIFIER_STUFFING: "IDENTIFIER_STUFFING",
} as const;

export type AnalyticsAbuseThreat =
  (typeof ANALYTICS_ABUSE_THREAT)[keyof typeof ANALYTICS_ABUSE_THREAT];

export const ANALYTICS_ABUSE_THREATS = Object.values(ANALYTICS_ABUSE_THREAT);

export const ANALYTICS_OPS_METRIC = {
  ACCEPTED: "analytics.accepted",
  DEDUPLICATED: "analytics.deduplicated",
  REJECTED_VALIDATION: "analytics.rejected_validation",
  REJECTED_RATE_LIMIT: "analytics.rejected_rate_limit",
  STORAGE_ERROR: "analytics.storage_error",
} as const;

export const ANALYTICS_RATE_LIMIT_POLICY = {
  WINDOW_MS: 60_000,
  MAX_REQUESTS_PER_WINDOW: 60,
  PRODUCTION_EDGE_CONTROL: "cloudflare",
  APPLICATION_GUARD: "IN_MEMORY_DEFENSE_IN_DEPTH",
} as const;

export const ANALYTICS_HTTP_BODY_MAX_BYTES = ANALYTICS_EVENT_MAX_BYTES;

export const ANALYTICS_CLOUDFLARE_TRUST = {
  TRUST_BOT_HEADERS: false,
  TRUST_CONNECTING_IP: false,
  REASON:
    "Direct origin and localhost can send arbitrary CF-* headers. Bot and IP signals are not authenticated truth until a trusted-proxy contract exists. Cloudflare edge rate limiting remains the production control.",
} as const;

export const ANALYTICS_RETENTION_ENFORCEMENT = {
  STATUS: "ENFORCEMENT_PENDING",
  CLEANUP_JOB_IMPLEMENTED: false,
} as const;

export const VIDEO_PLAY_MEASUREMENT = {
  STATUS: "DEFERRED",
  REASON: "PUBLIC_IFRAME_WITHOUT_TRUSTED_PLAYER_API",
  TAXONOMY_DEFINED: true,
  COMPLETION_AND_WATCH_TIME_DEFINED: false,
} as const;

export const ANALYTICS_DIMENSION_SNAPSHOT_POLICY = {
  STORE_DURABLE_IDS_AT_EVENT_TIME: true,
  STORE_DISPLAY_NAMES: false,
  HISTORICAL_REPORTING_USES_EVENT_TIME_IDS: true,
  CURRENT_NAMES_MAY_BE_RESOLVED_LATER: true,
} as const;

export const ANALYTICS_CONTENT_IDENTITY_POLICY = {
  PRIMARY_KEY: "contentItemId",
  VERSION_KEY: "publishedVersionId",
  SLUG_IS_CONTEXTUAL: true,
  TITLE_IS_NOT_IDENTITY: true,
} as const;

export const ANALYTICS_UTM_MAX_LENGTH = 100;
export const ANALYTICS_REFERRER_HOST_MAX_LENGTH = 253;
export const ANALYTICS_INTERNAL_PATH_MAX_LENGTH = 300;
export const ANALYTICS_AUTHOR_IDS_MAX = 8;
export const ANALYTICS_ENTITY_IDS_MAX = 8;

export function parseAnalyticsRawRetentionDays(
  raw: string | number | undefined,
): number {
  if (raw === undefined || raw === "") {
    return ANALYTICS_RETENTION_POLICY.DEFAULT_RAW_DAYS;
  }
  const value = typeof raw === "number" ? raw : Number(raw);
  if (
    !Number.isInteger(value) ||
    value < ANALYTICS_RETENTION_POLICY.MIN_RAW_DAYS ||
    value > ANALYTICS_RETENTION_POLICY.MAX_RAW_DAYS
  ) {
    return ANALYTICS_RETENTION_POLICY.DEFAULT_RAW_DAYS;
  }
  return value;
}
