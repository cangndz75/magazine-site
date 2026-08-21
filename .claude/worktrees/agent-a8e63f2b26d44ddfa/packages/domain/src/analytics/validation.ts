import { randomUUID } from "node:crypto";
import { ARTICLE_GALLERY_MAX_ITEMS } from "../article-gallery";
import { isUuid } from "../editor/query-bounds";
import { VIDEO_PROVIDERS, type VideoProvider } from "../editorial-video";
import {
  PUBLIC_LEGAL_NOTICE_KIND,
  type PublicLegalNoticeKind,
} from "../public-legal";
import { PUBLIC_ARTICLE_WITHDRAWAL_KIND } from "../public-legal";
import { canonicalizeContentSlug } from "../publishing/slug";
import {
  ANALYTICS_AUTHOR_IDS_MAX,
  ANALYTICS_EVENT_MAX_BYTES,
  ANALYTICS_INTERNAL_PATH_MAX_LENGTH,
  ANALYTICS_TAXONOMY_VERSION,
  ANALYTICS_TIMESTAMP_POLICY,
} from "./policy";
import {
  analyticsEventLeaksSensitiveMaterial,
  analyticsObjectHasPollutionKey,
} from "./privacy";
import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_GALLERY_NAVIGATION_METHODS,
  ANALYTICS_PLACEMENT,
  ANALYTICS_PLACEMENTS,
  ANALYTICS_SURFACE,
  ANALYTICS_SURFACES,
  analyticsHomepageSlotOrdinal,
  analyticsPlacementPositionBounds,
  isAnalyticsEventName,
  isRetiredAnalyticsEventName,
  type AnalyticsEventName,
  type AnalyticsGalleryNavigationMethod,
  type AnalyticsPlacement,
  type AnalyticsSurface,
} from "./taxonomy";
import {
  canonicalizeAnalyticsUtm,
  type AnalyticsUtmFields,
} from "./traffic";
import type {
  ArticleInternalClickProperties,
  ArticleOutboundClickProperties,
  ArticleViewProperties,
  GalleryEventProperties,
  HomepageContentInteractionProperties,
  HomepageViewProperties,
  PageViewProperties,
  VideoEventProperties,
} from "./events";

export const ANALYTICS_ERROR = {
  INVALID_ENVELOPE: "INVALID_ENVELOPE",
  UNKNOWN_EVENT: "UNKNOWN_EVENT",
  RETIRED_EVENT: "RETIRED_EVENT",
  UNSUPPORTED_SCHEMA_VERSION: "UNSUPPORTED_SCHEMA_VERSION",
  INVALID_PROPERTIES: "INVALID_PROPERTIES",
  EVENT_TOO_LARGE: "EVENT_TOO_LARGE",
  TIMESTAMP_OUT_OF_WINDOW: "TIMESTAMP_OUT_OF_WINDOW",
  SENSITIVE_MATERIAL: "SENSITIVE_MATERIAL",
  ARTICLE_VIEW_NOT_AUTHORITATIVE: "ARTICLE_VIEW_NOT_AUTHORITATIVE",
  INVALID_CONTEXT: "INVALID_CONTEXT",
  NOT_PUBLIC: "NOT_PUBLIC",
  RATE_LIMITED: "RATE_LIMITED",
  EVENT_ID_CONFLICT: "EVENT_ID_CONFLICT",
} as const;

export type AnalyticsErrorCode =
  (typeof ANALYTICS_ERROR)[keyof typeof ANALYTICS_ERROR];

export type AnalyticsDecision<T> =
  | { ok: true; value: T }
  | { ok: false; code: AnalyticsErrorCode };

export function generateAnalyticsEventId(): string {
  return randomUUID();
}

const ENVELOPE_KEYS = new Set([
  "eventId",
  "eventName",
  "schemaVersion",
  "occurredAt",
  "anonymousSessionId",
  "surface",
  "properties",
]);

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  for (const key of Object.keys(record)) {
    if (analyticsObjectHasPollutionKey(key) || !allowed.has(key)) {
      return true;
    }
  }
  return false;
}

function optionalUuid(value: unknown): AnalyticsDecision<string | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  if (typeof value !== "string" || !isUuid(value)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return { ok: true, value };
}

function requiredUuid(value: unknown): AnalyticsDecision<string> {
  if (typeof value !== "string" || !isUuid(value)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return { ok: true, value };
}

function requiredSlug(value: unknown): AnalyticsDecision<string> {
  if (typeof value !== "string") {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const canonical = canonicalizeContentSlug(value);
  if (!canonical.ok) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return { ok: true, value: canonical.value };
}

function optionalSlug(value: unknown): AnalyticsDecision<string | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  return requiredSlug(value);
}

function uuidList(value: unknown, max: number): AnalyticsDecision<string[] | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > max) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !isUuid(item) || seen.has(item)) {
      return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
    }
    seen.add(item);
    ids.push(item);
  }
  return { ok: true, value: ids };
}

function optionalUtm(value: unknown): AnalyticsDecision<AnalyticsUtmFields | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  const record = asObject(value);
  if (!record || rejectUnknownKeys(record, new Set(["source", "medium", "campaign"]))) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const canonical = canonicalizeAnalyticsUtm({
    source: typeof record.source === "string" ? record.source : null,
    medium: typeof record.medium === "string" ? record.medium : null,
    campaign: typeof record.campaign === "string" ? record.campaign : null,
  });
  if (
    (record.source !== undefined &&
      record.source !== null &&
      canonical.source === null) ||
    (record.medium !== undefined &&
      record.medium !== null &&
      canonical.medium === null) ||
    (record.campaign !== undefined &&
      record.campaign !== null &&
      canonical.campaign === null)
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return { ok: true, value: canonical };
}

function parseOccurredAt(value: unknown): AnalyticsDecision<Date> {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { ok: true, value };
  }
  if (typeof value !== "string" || value.length === 0) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_ENVELOPE };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_ENVELOPE };
  }
  return { ok: true, value: parsed };
}

export function analyticsTimestampIsWithinWindow(input: {
  occurredAt: Date;
  receivedAt: Date;
}): boolean {
  const delta = input.occurredAt.getTime() - input.receivedAt.getTime();
  if (delta > ANALYTICS_TIMESTAMP_POLICY.FUTURE_SKEW_MS) {
    return false;
  }
  if (-delta > ANALYTICS_TIMESTAMP_POLICY.MAX_AGE_MS) {
    return false;
  }
  return true;
}

function parseSurface(value: unknown): AnalyticsDecision<AnalyticsSurface> {
  if (typeof value !== "string") {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_ENVELOPE };
  }
  if (!(ANALYTICS_SURFACES as readonly string[]).includes(value)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_ENVELOPE };
  }
  return { ok: true, value: value as AnalyticsSurface };
}

function parsePlacement(value: unknown): AnalyticsDecision<AnalyticsPlacement> {
  if (typeof value !== "string") {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  if (!(ANALYTICS_PLACEMENTS as readonly string[]).includes(value)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return { ok: true, value: value as AnalyticsPlacement };
}

function parsePosition(
  value: unknown,
  placement: AnalyticsPlacement,
): AnalyticsDecision<number> {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const bounds = analyticsPlacementPositionBounds(placement);
  if (value < bounds.min || value > bounds.max) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return { ok: true, value };
}

function parsePageView(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<PageViewProperties> {
  if (
    rejectUnknownKeys(
      properties,
      new Set(["contentItemId", "publicSlug", "withdrawalKind", "utm"]),
    )
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  if (
    surface !== ANALYTICS_SURFACE.WITHDRAWN_SHELL &&
    surface !== ANALYTICS_SURFACE.OTHER_PUBLIC
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }

  const contentItemId = optionalUuid(properties.contentItemId);
  if (!contentItemId.ok) return contentItemId;
  const publicSlug = optionalSlug(properties.publicSlug);
  if (!publicSlug.ok) return publicSlug;
  const utm = optionalUtm(properties.utm);
  if (!utm.ok) return utm;

  let withdrawalKind: PageViewProperties["withdrawalKind"];
  if (surface === ANALYTICS_SURFACE.WITHDRAWN_SHELL) {
    if (
      properties.withdrawalKind !== PUBLIC_ARTICLE_WITHDRAWAL_KIND.RETRACTION &&
      properties.withdrawalKind !== PUBLIC_ARTICLE_WITHDRAWAL_KIND.TAKEDOWN
    ) {
      return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
    }
    if (!contentItemId.value || !publicSlug.value) {
      return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
    }
    withdrawalKind = properties.withdrawalKind;
  } else if (properties.withdrawalKind !== undefined) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }

  return {
    ok: true,
    value: {
      ...(contentItemId.value ? { contentItemId: contentItemId.value } : {}),
      ...(publicSlug.value ? { publicSlug: publicSlug.value } : {}),
      ...(withdrawalKind ? { withdrawalKind } : {}),
      ...(utm.value ? { utm: utm.value } : {}),
    },
  };
}

function parseArticleView(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<ArticleViewProperties> {
  if (surface !== ANALYTICS_SURFACE.ARTICLE) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  if (
    rejectUnknownKeys(
      properties,
      new Set([
        "contentItemId",
        "publishedVersionId",
        "publicSlug",
        "primaryCategoryId",
        "authorIds",
        "publicLegalNoticeKind",
        "utm",
      ]),
    )
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const contentItemId = requiredUuid(properties.contentItemId);
  if (!contentItemId.ok) return contentItemId;
  const publishedVersionId = requiredUuid(properties.publishedVersionId);
  if (!publishedVersionId.ok) return publishedVersionId;
  const publicSlug = requiredSlug(properties.publicSlug);
  if (!publicSlug.ok) return publicSlug;
  const primaryCategoryId = optionalUuid(properties.primaryCategoryId);
  if (!primaryCategoryId.ok) return primaryCategoryId;
  const authorIds = uuidList(properties.authorIds, ANALYTICS_AUTHOR_IDS_MAX);
  if (!authorIds.ok) return authorIds;
  const utm = optionalUtm(properties.utm);
  if (!utm.ok) return utm;

  let publicLegalNoticeKind: PublicLegalNoticeKind | undefined;
  if (properties.publicLegalNoticeKind !== undefined) {
    if (
      properties.publicLegalNoticeKind !== PUBLIC_LEGAL_NOTICE_KIND.CORRECTION &&
      properties.publicLegalNoticeKind !== PUBLIC_LEGAL_NOTICE_KIND.CLARIFICATION
    ) {
      return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
    }
    publicLegalNoticeKind = properties.publicLegalNoticeKind;
  }

  return {
    ok: true,
    value: {
      contentItemId: contentItemId.value,
      publishedVersionId: publishedVersionId.value,
      publicSlug: publicSlug.value,
      ...(primaryCategoryId.value
        ? { primaryCategoryId: primaryCategoryId.value }
        : {}),
      ...(authorIds.value ? { authorIds: authorIds.value } : {}),
      ...(publicLegalNoticeKind ? { publicLegalNoticeKind } : {}),
      ...(utm.value ? { utm: utm.value } : {}),
    },
  };
}

function parseHomepageView(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<HomepageViewProperties> {
  if (surface !== ANALYTICS_SURFACE.HOMEPAGE) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  if (rejectUnknownKeys(properties, new Set(["homepageVersionId", "utm"]))) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const homepageVersionId = optionalUuid(properties.homepageVersionId);
  if (!homepageVersionId.ok) return homepageVersionId;
  const utm = optionalUtm(properties.utm);
  if (!utm.ok) return utm;
  return {
    ok: true,
    value: {
      homepageVersionId: homepageVersionId.value ?? null,
      ...(utm.value ? { utm: utm.value } : {}),
    },
  };
}

const HOMEPAGE_CONTENT_PLACEMENTS = new Set<AnalyticsPlacement>([
  ANALYTICS_PLACEMENT.LEAD,
  ANALYTICS_PLACEMENT.SUPPORT_1,
  ANALYTICS_PLACEMENT.SUPPORT_2,
  ANALYTICS_PLACEMENT.FEATURED_1,
  ANALYTICS_PLACEMENT.FEATURED_2,
  ANALYTICS_PLACEMENT.FEATURED_3,
  ANALYTICS_PLACEMENT.FEATURED_4,
  ANALYTICS_PLACEMENT.FEATURED_5,
  ANALYTICS_PLACEMENT.CONVERSATION,
]);

function parseHomepageContentInteraction(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<HomepageContentInteractionProperties> {
  if (surface !== ANALYTICS_SURFACE.HOMEPAGE) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  if (
    rejectUnknownKeys(
      properties,
      new Set([
        "contentItemId",
        "publishedVersionId",
        "homepageVersionId",
        "placement",
        "position",
        "pageViewContextId",
      ]),
    )
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const contentItemId = requiredUuid(properties.contentItemId);
  if (!contentItemId.ok) return contentItemId;
  const publishedVersionId = requiredUuid(properties.publishedVersionId);
  if (!publishedVersionId.ok) return publishedVersionId;
  const homepageVersionId = optionalUuid(properties.homepageVersionId);
  if (!homepageVersionId.ok) return homepageVersionId;
  const placement = parsePlacement(properties.placement);
  if (!placement.ok) return placement;
  if (!HOMEPAGE_CONTENT_PLACEMENTS.has(placement.value)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const position = parsePosition(properties.position, placement.value);
  if (!position.ok) return position;
  if (placement.value !== ANALYTICS_PLACEMENT.CONVERSATION) {
    const expected = analyticsHomepageSlotOrdinal(
      placement.value as Parameters<typeof analyticsHomepageSlotOrdinal>[0],
    );
    if (position.value !== expected) {
      return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
    }
  }
  const pageViewContextId = requiredUuid(properties.pageViewContextId);
  if (!pageViewContextId.ok) return pageViewContextId;

  return {
    ok: true,
    value: {
      contentItemId: contentItemId.value,
      publishedVersionId: publishedVersionId.value,
      homepageVersionId: homepageVersionId.value ?? null,
      placement: placement.value,
      position: position.value,
      pageViewContextId: pageViewContextId.value,
    },
  };
}

function parseGallery(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
  eventName: AnalyticsEventName,
): AnalyticsDecision<GalleryEventProperties> {
  if (surface !== ANALYTICS_SURFACE.ARTICLE) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const allowed = new Set([
    "contentItemId",
    "publishedVersionId",
    "mediaId",
    "galleryPosition",
    "navigationMethod",
  ]);
  if (rejectUnknownKeys(properties, allowed)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const contentItemId = requiredUuid(properties.contentItemId);
  if (!contentItemId.ok) return contentItemId;
  const publishedVersionId = requiredUuid(properties.publishedVersionId);
  if (!publishedVersionId.ok) return publishedVersionId;
  const mediaId = requiredUuid(properties.mediaId);
  if (!mediaId.ok) return mediaId;
  if (
    typeof properties.galleryPosition !== "number" ||
    !Number.isInteger(properties.galleryPosition) ||
    properties.galleryPosition < 0 ||
    properties.galleryPosition >= ARTICLE_GALLERY_MAX_ITEMS
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }

  let navigationMethod: AnalyticsGalleryNavigationMethod | undefined;
  if (eventName === ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE) {
    if (
      typeof properties.navigationMethod !== "string" ||
      !(ANALYTICS_GALLERY_NAVIGATION_METHODS as readonly string[]).includes(
        properties.navigationMethod,
      )
    ) {
      return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
    }
    navigationMethod = properties.navigationMethod as AnalyticsGalleryNavigationMethod;
  } else if (properties.navigationMethod !== undefined) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }

  return {
    ok: true,
    value: {
      contentItemId: contentItemId.value,
      publishedVersionId: publishedVersionId.value,
      mediaId: mediaId.value,
      galleryPosition: properties.galleryPosition,
      ...(navigationMethod ? { navigationMethod } : {}),
    },
  };
}

function parseVideo(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<VideoEventProperties> {
  if (
    rejectUnknownKeys(
      properties,
      new Set([
        "videoAssetId",
        "provider",
        "contentItemId",
        "publishedVersionId",
        "homepageVersionId",
        "placement",
      ]),
    )
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const videoAssetId = requiredUuid(properties.videoAssetId);
  if (!videoAssetId.ok) return videoAssetId;
  if (
    typeof properties.provider !== "string" ||
    !(VIDEO_PROVIDERS as readonly string[]).includes(properties.provider)
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const placement = parsePlacement(properties.placement);
  if (!placement.ok) return placement;
  if (
    placement.value !== ANALYTICS_PLACEMENT.ARTICLE_VIDEO &&
    placement.value !== ANALYTICS_PLACEMENT.HOMEPAGE_VIDEO
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }

  const contentItemId = optionalUuid(properties.contentItemId);
  if (!contentItemId.ok) return contentItemId;
  const publishedVersionId = optionalUuid(properties.publishedVersionId);
  if (!publishedVersionId.ok) return publishedVersionId;
  const homepageVersionId = optionalUuid(properties.homepageVersionId);
  if (!homepageVersionId.ok) return homepageVersionId;

  if (placement.value === ANALYTICS_PLACEMENT.ARTICLE_VIDEO) {
    if (
      surface !== ANALYTICS_SURFACE.ARTICLE ||
      !contentItemId.value ||
      !publishedVersionId.value ||
      homepageVersionId.value
    ) {
      return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
    }
  } else if (
    surface !== ANALYTICS_SURFACE.HOMEPAGE ||
    !homepageVersionId.value ||
    contentItemId.value ||
    publishedVersionId.value
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }

  return {
    ok: true,
    value: {
      videoAssetId: videoAssetId.value,
      provider: properties.provider as VideoProvider,
      placement: placement.value,
      ...(contentItemId.value ? { contentItemId: contentItemId.value } : {}),
      ...(publishedVersionId.value
        ? { publishedVersionId: publishedVersionId.value }
        : {}),
      ...(homepageVersionId.value
        ? { homepageVersionId: homepageVersionId.value }
        : {}),
    },
  };
}

function parseOutboundClick(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<ArticleOutboundClickProperties> {
  if (surface !== ANALYTICS_SURFACE.ARTICLE) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  if (
    rejectUnknownKeys(
      properties,
      new Set(["contentItemId", "publishedVersionId", "destinationHost"]),
    )
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const contentItemId = requiredUuid(properties.contentItemId);
  if (!contentItemId.ok) return contentItemId;
  const publishedVersionId = requiredUuid(properties.publishedVersionId);
  if (!publishedVersionId.ok) return publishedVersionId;
  if (typeof properties.destinationHost !== "string") {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const host = properties.destinationHost.trim().toLowerCase();
  if (host.length === 0 || host.includes("/") || host.includes("?") || host.includes("#")) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return {
    ok: true,
    value: {
      contentItemId: contentItemId.value,
      publishedVersionId: publishedVersionId.value,
      destinationHost: host,
    },
  };
}

function parseInternalClick(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<ArticleInternalClickProperties> {
  if (surface !== ANALYTICS_SURFACE.ARTICLE) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  if (
    rejectUnknownKeys(
      properties,
      new Set(["contentItemId", "publishedVersionId", "destinationPath"]),
    )
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const contentItemId = requiredUuid(properties.contentItemId);
  if (!contentItemId.ok) return contentItemId;
  const publishedVersionId = requiredUuid(properties.publishedVersionId);
  if (!publishedVersionId.ok) return publishedVersionId;
  if (typeof properties.destinationPath !== "string") {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const path = properties.destinationPath.trim();
  if (
    !path.startsWith("/") ||
    path.includes("?") ||
    path.includes("#") ||
    path.length > ANALYTICS_INTERNAL_PATH_MAX_LENGTH
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return {
    ok: true,
    value: {
      contentItemId: contentItemId.value,
      publishedVersionId: publishedVersionId.value,
      destinationPath: path,
    },
  };
}

export type ParsedClientAnalyticsEvent =
  | {
      eventId: string;
      eventName: "PAGE_VIEW";
      schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
      occurredAt: Date;
      anonymousSessionId: string | null;
      surface: AnalyticsSurface;
      properties: PageViewProperties;
    }
  | {
      eventId: string;
      eventName: "ARTICLE_VIEW";
      schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
      occurredAt: Date;
      anonymousSessionId: string | null;
      surface: AnalyticsSurface;
      properties: ArticleViewProperties;
    }
  | {
      eventId: string;
      eventName: "HOMEPAGE_VIEW";
      schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
      occurredAt: Date;
      anonymousSessionId: string | null;
      surface: AnalyticsSurface;
      properties: HomepageViewProperties;
    }
  | {
      eventId: string;
      eventName: "HOMEPAGE_CONTENT_IMPRESSION";
      schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
      occurredAt: Date;
      anonymousSessionId: string | null;
      surface: AnalyticsSurface;
      properties: HomepageContentInteractionProperties;
    }
  | {
      eventId: string;
      eventName: "HOMEPAGE_CONTENT_CLICK";
      schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
      occurredAt: Date;
      anonymousSessionId: string | null;
      surface: AnalyticsSurface;
      properties: HomepageContentInteractionProperties;
    }
  | {
      eventId: string;
      eventName: "GALLERY_OPEN";
      schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
      occurredAt: Date;
      anonymousSessionId: string | null;
      surface: AnalyticsSurface;
      properties: GalleryEventProperties;
    }
  | {
      eventId: string;
      eventName: "GALLERY_IMAGE_VIEW";
      schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
      occurredAt: Date;
      anonymousSessionId: string | null;
      surface: AnalyticsSurface;
      properties: GalleryEventProperties;
    }
  | {
      eventId: string;
      eventName: "GALLERY_NAVIGATE";
      schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
      occurredAt: Date;
      anonymousSessionId: string | null;
      surface: AnalyticsSurface;
      properties: GalleryEventProperties;
    }
  | {
      eventId: string;
      eventName: "VIDEO_IMPRESSION";
      schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
      occurredAt: Date;
      anonymousSessionId: string | null;
      surface: AnalyticsSurface;
      properties: VideoEventProperties;
    }
  | {
      eventId: string;
      eventName: "VIDEO_PLAY";
      schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
      occurredAt: Date;
      anonymousSessionId: string | null;
      surface: AnalyticsSurface;
      properties: VideoEventProperties;
    }
  | {
      eventId: string;
      eventName: "ARTICLE_OUTBOUND_CLICK";
      schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
      occurredAt: Date;
      anonymousSessionId: string | null;
      surface: AnalyticsSurface;
      properties: ArticleOutboundClickProperties;
    }
  | {
      eventId: string;
      eventName: "ARTICLE_INTERNAL_CLICK";
      schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
      occurredAt: Date;
      anonymousSessionId: string | null;
      surface: AnalyticsSurface;
      properties: ArticleInternalClickProperties;
    };

export function parseClientAnalyticsEvent(
  input: unknown,
): AnalyticsDecision<ParsedClientAnalyticsEvent> {
  const record = asObject(input);
  if (!record || rejectUnknownKeys(record, ENVELOPE_KEYS)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_ENVELOPE };
  }
  if (analyticsEventLeaksSensitiveMaterial(record)) {
    return { ok: false, code: ANALYTICS_ERROR.SENSITIVE_MATERIAL };
  }

  const eventId = requiredUuid(record.eventId);
  if (!eventId.ok) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_ENVELOPE };
  }
  if (typeof record.eventName !== "string") {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_ENVELOPE };
  }
  if (isRetiredAnalyticsEventName(record.eventName)) {
    return { ok: false, code: ANALYTICS_ERROR.RETIRED_EVENT };
  }
  if (!isAnalyticsEventName(record.eventName)) {
    return { ok: false, code: ANALYTICS_ERROR.UNKNOWN_EVENT };
  }
  if (record.schemaVersion !== ANALYTICS_TAXONOMY_VERSION) {
    return { ok: false, code: ANALYTICS_ERROR.UNSUPPORTED_SCHEMA_VERSION };
  }
  const occurredAt = parseOccurredAt(record.occurredAt);
  if (!occurredAt.ok) return occurredAt;
  const surface = parseSurface(record.surface);
  if (!surface.ok) return surface;

  let anonymousSessionId: string | null = null;
  if (record.anonymousSessionId !== undefined && record.anonymousSessionId !== null) {
    if (typeof record.anonymousSessionId !== "string" || !isUuid(record.anonymousSessionId)) {
      return { ok: false, code: ANALYTICS_ERROR.INVALID_ENVELOPE };
    }
    anonymousSessionId = record.anonymousSessionId;
  }

  const properties = asObject(record.properties);
  if (!properties) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }

  const parsedProperties = parseEventProperties(
    record.eventName,
    properties,
    surface.value,
  );
  if (!parsedProperties.ok) return parsedProperties;

  const candidate = {
    eventId: eventId.value,
    eventName: record.eventName,
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    occurredAt: occurredAt.value,
    anonymousSessionId,
    surface: surface.value,
    properties: parsedProperties.value,
  } as ParsedClientAnalyticsEvent;

  const serialized = Buffer.byteLength(JSON.stringify(candidate), "utf8");
  if (serialized > ANALYTICS_EVENT_MAX_BYTES) {
    return { ok: false, code: ANALYTICS_ERROR.EVENT_TOO_LARGE };
  }

  return { ok: true, value: candidate };
}

function parseEventProperties(
  eventName: AnalyticsEventName,
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<ParsedClientAnalyticsEvent["properties"]> {
  switch (eventName) {
    case ANALYTICS_EVENT_NAME.PAGE_VIEW:
      return parsePageView(properties, surface);
    case ANALYTICS_EVENT_NAME.ARTICLE_VIEW:
      return parseArticleView(properties, surface);
    case ANALYTICS_EVENT_NAME.HOMEPAGE_VIEW:
      return parseHomepageView(properties, surface);
    case ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION:
    case ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK:
      return parseHomepageContentInteraction(properties, surface);
    case ANALYTICS_EVENT_NAME.GALLERY_OPEN:
    case ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW:
    case ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE:
      return parseGallery(properties, surface, eventName);
    case ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION:
    case ANALYTICS_EVENT_NAME.VIDEO_PLAY:
      return parseVideo(properties, surface);
    case ANALYTICS_EVENT_NAME.ARTICLE_OUTBOUND_CLICK:
      return parseOutboundClick(properties, surface);
    case ANALYTICS_EVENT_NAME.ARTICLE_INTERNAL_CLICK:
      return parseInternalClick(properties, surface);
  }
}
