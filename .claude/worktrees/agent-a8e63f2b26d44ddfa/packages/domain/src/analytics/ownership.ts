/**
 * Client/server field ownership for public analytics ingestion.
 *
 * Client values identify the interaction. Server values identify the
 * published fact. Client attempts to set server-owned fields are ignored
 * or matched fail-closed; they never become stored authority.
 */

export const ANALYTICS_CLIENT_OBSERVED_FIELDS = [
  "eventId",
  "eventName",
  "schemaVersion",
  "occurredAt",
  "surface",
  "contentItemId",
  "publicSlug",
  "placement",
  "position",
  "pageViewContextId",
  "mediaId",
  "galleryPosition",
  "navigationMethod",
  "videoAssetId",
  "destinationHost",
  "destinationPath",
  "utm",
] as const;

export const ANALYTICS_CLIENT_HINT_FIELDS = [
  "publishedVersionId",
  "homepageVersionId",
  "withdrawalKind",
] as const;

export const ANALYTICS_SERVER_OWNED_FIELDS = [
  "receivedAt",
  "trafficKind",
  "trafficSource",
  "referrerHost",
  "anonymousVisitorId",
  "anonymousSessionId",
  "publishedVersionId",
  "primaryCategoryId",
  "authorIds",
  "publicLegalNoticeKind",
  "provider",
  "homepageVersionId",
  "withdrawalKind",
] as const;

export const ANALYTICS_IGNORED_CLIENT_OVERRIDES = [
  "primaryCategoryId",
  "authorIds",
  "entityIds",
  "publicLegalNoticeKind",
  "provider",
  "trafficKind",
  "trafficSource",
  "referrerHost",
  "receivedAt",
  "anonymousVisitorId",
] as const;

export const ANALYTICS_FIELD_OWNERSHIP = {
  CLIENT_OBSERVED: ANALYTICS_CLIENT_OBSERVED_FIELDS,
  CLIENT_HINT: ANALYTICS_CLIENT_HINT_FIELDS,
  SERVER_OWNED: ANALYTICS_SERVER_OWNED_FIELDS,
  IGNORED_CLIENT_OVERRIDES: ANALYTICS_IGNORED_CLIENT_OVERRIDES,
  HINT_MATCH_POLICY: "FAIL_CLOSED",
} as const;
