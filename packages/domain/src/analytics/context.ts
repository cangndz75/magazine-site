import { createHmac, timingSafeEqual } from "node:crypto";
import { isUuid } from "../editor/query-bounds";
import { ANALYTICS_TIMESTAMP_POLICY } from "./policy";
import { ANALYTICS_ERROR, type AnalyticsDecision } from "./validation";
import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_PLACEMENTS,
  ANALYTICS_SURFACES,
  type AnalyticsEventName,
  type AnalyticsPlacement,
  type AnalyticsSurface,
} from "./taxonomy";
import type { AnalyticsWireEvent } from "./wire";

/**
 * Tamper-evident event-time context. This preserves what the server rendered,
 * not Ads-grade anti-fraud. A copied valid token can still be replayed.
 */
export const ANALYTICS_CONTEXT_VERSION = 1 as const;
export const ANALYTICS_CONTEXT_TTL_MS = ANALYTICS_TIMESTAMP_POLICY.MAX_AGE_MS;
export const ANALYTICS_CONTEXT_CLOCK_SKEW_MS = ANALYTICS_TIMESTAMP_POLICY.FUTURE_SKEW_MS;
export const ANALYTICS_CONTEXT_TOKEN_PREFIX = "v1";
export const ANALYTICS_CONTEXT_SIGNING_KEY_MIN_LENGTH = 32;
export const ANALYTICS_CONTEXT_TOKEN_MAX_LENGTH = 2048;

export const ANALYTICS_CONTEXT_FRAUD_BOUNDARY = {
  PURPOSE: "EVENT_CONTEXT_INTEGRITY",
  ADS_GRADE_ANTI_FRAUD: false,
  REPLAY_BY_HOSTILE_BROWSER: true,
} as const;

export type AnalyticsContextClaims = {
  v: typeof ANALYTICS_CONTEXT_VERSION;
  surface: AnalyticsSurface;
  contentItemId: string | null;
  publishedVersionId: string | null;
  homepageVersionId: string | null;
  placement: AnalyticsPlacement | null;
  position: number | null;
  mediaId: string | null;
  videoAssetId: string | null;
  iat: number;
  exp: number;
};

const CLAIM_KEYS = [
  "v",
  "surface",
  "contentItemId",
  "publishedVersionId",
  "homepageVersionId",
  "placement",
  "position",
  "mediaId",
  "videoAssetId",
  "iat",
  "exp",
] as const;

const FORBIDDEN_CLAIM_KEYS = [
  "title",
  "body",
  "authorName",
  "categoryName",
  "internalNote",
  "storageKey",
  "submittedUrl",
  "rightsNote",
  "staffUserId",
] as const;

export function analyticsEventRequiresSignedContext(
  eventName: AnalyticsEventName,
): boolean {
  switch (eventName) {
    case ANALYTICS_EVENT_NAME.ARTICLE_VIEW:
    case ANALYTICS_EVENT_NAME.HOMEPAGE_VIEW:
    case ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION:
    case ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK:
    case ANALYTICS_EVENT_NAME.GALLERY_OPEN:
    case ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW:
    case ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE:
    case ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION:
    case ANALYTICS_EVENT_NAME.VIDEO_PLAY:
    case ANALYTICS_EVENT_NAME.ARTICLE_OUTBOUND_CLICK:
    case ANALYTICS_EVENT_NAME.ARTICLE_INTERNAL_CLICK:
      return true;
    default:
      return false;
  }
}

function canonicalPayload(claims: AnalyticsContextClaims): string {
  const ordered: Record<string, unknown> = {};
  for (const key of CLAIM_KEYS) {
    ordered[key] = claims[key];
  }
  return JSON.stringify(ordered);
}

function hmacSha256(key: string, payload: string): Buffer {
  return createHmac("sha256", key).update(payload).digest();
}

function optionalUuidClaim(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || !isUuid(value)) {
    return undefined;
  }
  return value;
}

function parseClaims(value: unknown): AnalyticsContextClaims | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(CLAIM_KEYS as readonly string[]).includes(key)) {
      return null;
    }
    if ((FORBIDDEN_CLAIM_KEYS as readonly string[]).includes(key)) {
      return null;
    }
  }
  if (record.v !== ANALYTICS_CONTEXT_VERSION) {
    return null;
  }
  if (
    typeof record.surface !== "string" ||
    !ANALYTICS_SURFACES.includes(record.surface as AnalyticsSurface)
  ) {
    return null;
  }
  const contentItemId = optionalUuidClaim(record.contentItemId);
  const publishedVersionId = optionalUuidClaim(record.publishedVersionId);
  const homepageVersionId = optionalUuidClaim(record.homepageVersionId);
  const mediaId = optionalUuidClaim(record.mediaId);
  const videoAssetId = optionalUuidClaim(record.videoAssetId);
  if (
    contentItemId === undefined ||
    publishedVersionId === undefined ||
    homepageVersionId === undefined ||
    mediaId === undefined ||
    videoAssetId === undefined
  ) {
    return null;
  }
  let placement: AnalyticsPlacement | null = null;
  if (record.placement !== null) {
    if (
      typeof record.placement !== "string" ||
      !ANALYTICS_PLACEMENTS.includes(record.placement as AnalyticsPlacement)
    ) {
      return null;
    }
    placement = record.placement as AnalyticsPlacement;
  }
  let position: number | null = null;
  if (record.position !== null) {
    if (
      typeof record.position !== "number" ||
      !Number.isInteger(record.position) ||
      record.position < 0 ||
      record.position > 15
    ) {
      return null;
    }
    position = record.position;
  }
  if (typeof record.iat !== "number" || !Number.isInteger(record.iat)) {
    return null;
  }
  if (typeof record.exp !== "number" || !Number.isInteger(record.exp)) {
    return null;
  }
  return {
    v: ANALYTICS_CONTEXT_VERSION,
    surface: record.surface as AnalyticsSurface,
    contentItemId,
    publishedVersionId,
    homepageVersionId,
    placement,
    position,
    mediaId,
    videoAssetId,
    iat: record.iat,
    exp: record.exp,
  };
}

export function signAnalyticsContext(input: {
  signingKey: string;
  now: Date;
  surface: AnalyticsSurface;
  contentItemId?: string | null;
  publishedVersionId?: string | null;
  homepageVersionId?: string | null;
  placement?: AnalyticsPlacement | null;
  position?: number | null;
  mediaId?: string | null;
  videoAssetId?: string | null;
  ttlMs?: number;
}): string {
  if (input.signingKey.length < ANALYTICS_CONTEXT_SIGNING_KEY_MIN_LENGTH) {
    throw new Error("ANALYTICS_CONTEXT_SIGNING_KEY is too short");
  }
  const iat = input.now.getTime();
  const claims: AnalyticsContextClaims = {
    v: ANALYTICS_CONTEXT_VERSION,
    surface: input.surface,
    contentItemId: input.contentItemId ?? null,
    publishedVersionId: input.publishedVersionId ?? null,
    homepageVersionId: input.homepageVersionId ?? null,
    placement: input.placement ?? null,
    position: input.position ?? null,
    mediaId: input.mediaId ?? null,
    videoAssetId: input.videoAssetId ?? null,
    iat,
    exp: iat + (input.ttlMs ?? ANALYTICS_CONTEXT_TTL_MS),
  };
  const encoded = Buffer.from(canonicalPayload(claims), "utf8").toString("base64url");
  const signature = hmacSha256(input.signingKey, encoded).toString("base64url");
  return `${ANALYTICS_CONTEXT_TOKEN_PREFIX}.${encoded}.${signature}`;
}

export function verifyAnalyticsContextToken(input: {
  token: string;
  signingKey: string;
}): AnalyticsDecision<AnalyticsContextClaims> {
  if (
    typeof input.token !== "string" ||
    input.token.length === 0 ||
    input.token.length > ANALYTICS_CONTEXT_TOKEN_MAX_LENGTH ||
    input.signingKey.length < ANALYTICS_CONTEXT_SIGNING_KEY_MIN_LENGTH
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  const parts = input.token.split(".");
  if (parts.length !== 3 || parts[0] !== ANALYTICS_CONTEXT_TOKEN_PREFIX) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  const encoded = parts[1];
  const signature = parts[2];
  if (!encoded || !signature) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  const expected = hmacSha256(input.signingKey, encoded);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  const claims = parseClaims(parsed);
  if (!claims) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  if (canonicalPayload(claims) !== Buffer.from(encoded, "base64url").toString("utf8")) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  return { ok: true, value: claims };
}

function propertyContentItemId(wire: AnalyticsWireEvent): string | undefined {
  const properties = wire.properties as { contentItemId?: string };
  return properties.contentItemId;
}

function eventCompatibleWithClaims(
  wire: AnalyticsWireEvent,
  claims: AnalyticsContextClaims,
): boolean {
  if (wire.surface !== claims.surface) {
    return false;
  }
  const contentItemId = propertyContentItemId(wire);
  if (claims.contentItemId && contentItemId && claims.contentItemId !== contentItemId) {
    return false;
  }
  if (
    wire.claimedPublishedVersionId &&
    claims.publishedVersionId &&
    wire.claimedPublishedVersionId !== claims.publishedVersionId
  ) {
    return false;
  }
  if (
    wire.claimedHomepageVersionId !== undefined &&
    wire.claimedHomepageVersionId !== null &&
    claims.homepageVersionId &&
    wire.claimedHomepageVersionId !== claims.homepageVersionId
  ) {
    return false;
  }

  switch (wire.eventName) {
    case ANALYTICS_EVENT_NAME.ARTICLE_VIEW:
    case ANALYTICS_EVENT_NAME.GALLERY_OPEN:
    case ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW:
    case ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE:
    case ANALYTICS_EVENT_NAME.ARTICLE_OUTBOUND_CLICK:
    case ANALYTICS_EVENT_NAME.ARTICLE_INTERNAL_CLICK:
      return (
        claims.contentItemId !== null &&
        claims.publishedVersionId !== null &&
        contentItemId === claims.contentItemId
      );
    case ANALYTICS_EVENT_NAME.HOMEPAGE_VIEW:
      return claims.contentItemId === null && claims.placement === null;
    case ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION:
    case ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK: {
      if (wire.properties.eventName !== wire.eventName) {
        return false;
      }
      return (
        claims.contentItemId === wire.properties.contentItemId &&
        claims.publishedVersionId !== null &&
        claims.placement === wire.properties.placement &&
        claims.position === wire.properties.position
      );
    }
    case ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION:
    case ANALYTICS_EVENT_NAME.VIDEO_PLAY: {
      if (
        wire.properties.eventName !== "VIDEO_IMPRESSION" &&
        wire.properties.eventName !== "VIDEO_PLAY"
      ) {
        return false;
      }
      if (wire.properties.placement === "ARTICLE_VIDEO") {
        return (
          claims.surface === "ARTICLE" &&
          claims.contentItemId === wire.properties.contentItemId &&
          claims.publishedVersionId !== null
        );
      }
      return (
        claims.placement === "HOMEPAGE_VIDEO" &&
        claims.homepageVersionId !== null &&
        (claims.videoAssetId === null ||
          claims.videoAssetId === wire.properties.videoAssetId)
      );
    }
    default:
      return !analyticsEventRequiresSignedContext(wire.eventName);
  }
}

export function bindAnalyticsWireContext(input: {
  wire: AnalyticsWireEvent;
  signingKey: string | null | undefined;
}): AnalyticsDecision<AnalyticsContextClaims | null> {
  const required = analyticsEventRequiresSignedContext(input.wire.eventName);
  const token = input.wire.analyticsContext;
  if (!token) {
    return required
      ? { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT }
      : { ok: true, value: null };
  }
  if (!input.signingKey) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  const verified = verifyAnalyticsContextToken({
    token,
    signingKey: input.signingKey,
  });
  if (!verified.ok) {
    return verified;
  }
  const claims = verified.value;
  if (claims.exp <= claims.iat) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  const occurredAt = input.wire.occurredAt.getTime();
  if (occurredAt + ANALYTICS_CONTEXT_CLOCK_SKEW_MS < claims.iat) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  if (occurredAt > claims.exp) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  if (!eventCompatibleWithClaims(input.wire, claims)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }
  return { ok: true, value: claims };
}
