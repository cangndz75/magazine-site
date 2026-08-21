import { isUuid } from "../editor/query-bounds";
import { ARTICLE_GALLERY_MAX_ITEMS } from "../article-gallery";
import { canonicalizeContentSlug } from "../publishing/slug";
import {
  ANALYTICS_EVENT_MAX_BYTES,
  ANALYTICS_INTERNAL_PATH_MAX_LENGTH,
  ANALYTICS_TAXONOMY_VERSION,
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
  ANALYTICS_HOMEPAGE_SLOT_PLACEMENTS,
} from "./taxonomy";
import { canonicalizeAnalyticsUtm, normalizeAnalyticsHostname, type AnalyticsUtmFields } from "./traffic";
import { ANALYTICS_ERROR, type AnalyticsDecision } from "./validation";
import { ANALYTICS_IGNORED_CLIENT_OVERRIDES } from "./ownership";

export type AnalyticsWireEvent = {
  eventId: string;
  eventName: AnalyticsEventName;
  schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
  occurredAt: Date;
  surface: AnalyticsSurface;
  claimedPublishedVersionId?: string;
  claimedHomepageVersionId?: string | null;
  analyticsContext?: string;
  properties: AnalyticsWireProperties;
};

export type AnalyticsWireProperties =
  | {
      eventName: "PAGE_VIEW";
      contentItemId?: string;
      publicSlug?: string;
      claimedWithdrawalKind?: "RETRACTION" | "TAKEDOWN";
      utm?: AnalyticsUtmFields;
    }
  | {
      eventName: "ARTICLE_VIEW";
      contentItemId: string;
      publicSlug?: string;
      utm?: AnalyticsUtmFields;
    }
  | {
      eventName: "HOMEPAGE_VIEW";
      utm?: AnalyticsUtmFields;
    }
  | {
      eventName: "HOMEPAGE_CONTENT_IMPRESSION" | "HOMEPAGE_CONTENT_CLICK";
      contentItemId: string;
      placement: AnalyticsPlacement;
      position: number;
      pageViewContextId: string;
    }
  | {
      eventName: "GALLERY_OPEN" | "GALLERY_IMAGE_VIEW" | "GALLERY_NAVIGATE";
      contentItemId: string;
      mediaId: string;
      galleryPosition: number;
      navigationMethod?: AnalyticsGalleryNavigationMethod;
    }
  | {
      eventName: "VIDEO_IMPRESSION" | "VIDEO_PLAY";
      videoAssetId: string;
      placement: AnalyticsPlacement;
      contentItemId?: string;
    }
  | {
      eventName: "ARTICLE_OUTBOUND_CLICK";
      contentItemId: string;
      destinationHost: string;
    }
  | {
      eventName: "ARTICLE_INTERNAL_CLICK";
      contentItemId: string;
      destinationPath: string;
    };

const ENVELOPE_KEYS = new Set([
  "eventId",
  "eventName",
  "schemaVersion",
  "occurredAt",
  "anonymousSessionId",
  "surface",
  "analyticsContext",
  "properties",
]);

const IGNORED = new Set<string>(ANALYTICS_IGNORED_CLIENT_OVERRIDES);

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
    if (analyticsObjectHasPollutionKey(key)) {
      return true;
    }
    if (IGNORED.has(key)) {
      continue;
    }
    if (!allowed.has(key)) {
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

function optionalSlug(value: unknown): AnalyticsDecision<string | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  if (typeof value !== "string") {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const canonical = canonicalizeContentSlug(value);
  if (!canonical.ok) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return { ok: true, value: canonical.value };
}

function optionalUtm(value: unknown): AnalyticsDecision<AnalyticsUtmFields | undefined> {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  const record = asObject(value);
  if (
    record === null ||
    rejectUnknownKeys(record, new Set(["source", "medium", "campaign"]))
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return {
    ok: true,
    value: canonicalizeAnalyticsUtm({
      source: typeof record.source === "string" ? record.source : null,
      medium: typeof record.medium === "string" ? record.medium : null,
      campaign: typeof record.campaign === "string" ? record.campaign : null,
    }),
  };
}

function requiredInt(
  value: unknown,
  min: number,
  max: number,
): AnalyticsDecision<number> {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return { ok: true, value };
}

function requiredPlacement(value: unknown): AnalyticsDecision<AnalyticsPlacement> {
  if (typeof value !== "string" || !ANALYTICS_PLACEMENTS.includes(value as AnalyticsPlacement)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return { ok: true, value: value as AnalyticsPlacement };
}

function parseOccurredAt(value: unknown): AnalyticsDecision<Date> {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { ok: true, value };
  }
  if (typeof value !== "string" || value.length === 0 || value.length > 40) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_ENVELOPE };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_ENVELOPE };
  }
  return { ok: true, value: parsed };
}

function parsePageViewWire(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<Extract<AnalyticsWireProperties, { eventName: "PAGE_VIEW" }>> {
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
  if (surface === ANALYTICS_SURFACE.WITHDRAWN_SHELL && !contentItemId.value) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const claimedWithdrawalKind =
    properties.withdrawalKind === "RETRACTION" || properties.withdrawalKind === "TAKEDOWN"
      ? properties.withdrawalKind
      : undefined;
  return {
    ok: true,
    value: {
      eventName: ANALYTICS_EVENT_NAME.PAGE_VIEW,
      ...(contentItemId.value ? { contentItemId: contentItemId.value } : {}),
      ...(publicSlug.value ? { publicSlug: publicSlug.value } : {}),
      ...(claimedWithdrawalKind ? { claimedWithdrawalKind } : {}),
      ...(utm.value ? { utm: utm.value } : {}),
    },
  };
}

function parseArticleViewWire(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<{
  properties: Extract<AnalyticsWireProperties, { eventName: "ARTICLE_VIEW" }>;
  claimedPublishedVersionId?: string;
}> {
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
  const claimedPublishedVersionId = optionalUuid(properties.publishedVersionId);
  if (!claimedPublishedVersionId.ok) return claimedPublishedVersionId;
  const publicSlug = optionalSlug(properties.publicSlug);
  if (!publicSlug.ok) return publicSlug;
  const utm = optionalUtm(properties.utm);
  if (!utm.ok) return utm;
  return {
    ok: true,
    value: {
      claimedPublishedVersionId: claimedPublishedVersionId.value,
      properties: {
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        contentItemId: contentItemId.value,
        ...(publicSlug.value ? { publicSlug: publicSlug.value } : {}),
        ...(utm.value ? { utm: utm.value } : {}),
      },
    },
  };
}

function parseHomepageViewWire(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<{
  properties: Extract<AnalyticsWireProperties, { eventName: "HOMEPAGE_VIEW" }>;
  claimedHomepageVersionId?: string | null;
}> {
  if (surface !== ANALYTICS_SURFACE.HOMEPAGE) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  if (rejectUnknownKeys(properties, new Set(["homepageVersionId", "utm"]))) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const utm = optionalUtm(properties.utm);
  if (!utm.ok) return utm;
  let claimedHomepageVersionId: string | null | undefined;
  if (properties.homepageVersionId === null) {
    claimedHomepageVersionId = null;
  } else {
    const parsed = optionalUuid(properties.homepageVersionId);
    if (!parsed.ok) return parsed;
    claimedHomepageVersionId = parsed.value;
  }
  return {
    ok: true,
    value: {
      claimedHomepageVersionId,
      properties: {
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_VIEW,
        ...(utm.value ? { utm: utm.value } : {}),
      },
    },
  };
}

function parseHomepageContentWire(
  eventName: "HOMEPAGE_CONTENT_IMPRESSION" | "HOMEPAGE_CONTENT_CLICK",
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<{
  properties: Extract<
    AnalyticsWireProperties,
    { eventName: "HOMEPAGE_CONTENT_IMPRESSION" | "HOMEPAGE_CONTENT_CLICK" }
  >;
  claimedHomepageVersionId?: string;
  claimedPublishedVersionId?: string;
}> {
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
  const placement = requiredPlacement(properties.placement);
  if (!placement.ok) return placement;
  const bounds = analyticsPlacementPositionBounds(placement.value);
  const position = requiredInt(properties.position, bounds.min, bounds.max);
  if (!position.ok) return position;
  if (
    (ANALYTICS_HOMEPAGE_SLOT_PLACEMENTS as readonly string[]).includes(placement.value)
  ) {
    const ordinal = analyticsHomepageSlotOrdinal(
      placement.value as (typeof ANALYTICS_HOMEPAGE_SLOT_PLACEMENTS)[number],
    );
    if (position.value !== ordinal) {
      return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
    }
  }
  if (typeof properties.pageViewContextId !== "string" || !isUuid(properties.pageViewContextId)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const claimedHomepageVersionId = optionalUuid(properties.homepageVersionId);
  if (!claimedHomepageVersionId.ok) return claimedHomepageVersionId;
  const claimedPublishedVersionId = optionalUuid(properties.publishedVersionId);
  if (!claimedPublishedVersionId.ok) return claimedPublishedVersionId;
  return {
    ok: true,
    value: {
      claimedHomepageVersionId: claimedHomepageVersionId.value,
      claimedPublishedVersionId: claimedPublishedVersionId.value,
      properties: {
        eventName,
        contentItemId: contentItemId.value,
        placement: placement.value,
        position: position.value,
        pageViewContextId: properties.pageViewContextId,
      },
    },
  };
}

function parseGalleryWire(
  eventName: "GALLERY_OPEN" | "GALLERY_IMAGE_VIEW" | "GALLERY_NAVIGATE",
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<{
  properties: Extract<
    AnalyticsWireProperties,
    { eventName: "GALLERY_OPEN" | "GALLERY_IMAGE_VIEW" | "GALLERY_NAVIGATE" }
  >;
  claimedPublishedVersionId?: string;
}> {
  if (surface !== ANALYTICS_SURFACE.ARTICLE) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  if (
    rejectUnknownKeys(
      properties,
      new Set([
        "contentItemId",
        "publishedVersionId",
        "mediaId",
        "galleryPosition",
        "navigationMethod",
        "placement",
      ]),
    )
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const contentItemId = requiredUuid(properties.contentItemId);
  if (!contentItemId.ok) return contentItemId;
  const mediaId = requiredUuid(properties.mediaId);
  if (!mediaId.ok) return mediaId;
  const galleryPosition = requiredInt(properties.galleryPosition, 0, ARTICLE_GALLERY_MAX_ITEMS - 1);
  if (!galleryPosition.ok) return galleryPosition;
  const claimedPublishedVersionId = optionalUuid(properties.publishedVersionId);
  if (!claimedPublishedVersionId.ok) return claimedPublishedVersionId;
  let navigationMethod: AnalyticsGalleryNavigationMethod | undefined;
  if (eventName === ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE) {
    if (
      typeof properties.navigationMethod !== "string" ||
      !ANALYTICS_GALLERY_NAVIGATION_METHODS.includes(
        properties.navigationMethod as AnalyticsGalleryNavigationMethod,
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
      claimedPublishedVersionId: claimedPublishedVersionId.value,
      properties: {
        eventName,
        contentItemId: contentItemId.value,
        mediaId: mediaId.value,
        galleryPosition: galleryPosition.value,
        ...(navigationMethod ? { navigationMethod } : {}),
      },
    },
  };
}

function parseVideoWire(
  eventName: "VIDEO_IMPRESSION" | "VIDEO_PLAY",
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<{
  properties: Extract<
    AnalyticsWireProperties,
    { eventName: "VIDEO_IMPRESSION" | "VIDEO_PLAY" }
  >;
  claimedPublishedVersionId?: string;
  claimedHomepageVersionId?: string;
}> {
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
  const placement = requiredPlacement(properties.placement);
  if (!placement.ok) return placement;
  if (
    placement.value !== ANALYTICS_PLACEMENT.ARTICLE_VIDEO &&
    placement.value !== ANALYTICS_PLACEMENT.HOMEPAGE_VIDEO
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  if (placement.value === ANALYTICS_PLACEMENT.ARTICLE_VIDEO) {
    if (surface !== ANALYTICS_SURFACE.ARTICLE) {
      return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
    }
  } else if (surface !== ANALYTICS_SURFACE.HOMEPAGE) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const contentItemId = optionalUuid(properties.contentItemId);
  if (!contentItemId.ok) return contentItemId;
  const claimedPublishedVersionId = optionalUuid(properties.publishedVersionId);
  if (!claimedPublishedVersionId.ok) return claimedPublishedVersionId;
  const claimedHomepageVersionId = optionalUuid(properties.homepageVersionId);
  if (!claimedHomepageVersionId.ok) return claimedHomepageVersionId;
  if (placement.value === ANALYTICS_PLACEMENT.ARTICLE_VIDEO && !contentItemId.value) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return {
    ok: true,
    value: {
      claimedPublishedVersionId: claimedPublishedVersionId.value,
      claimedHomepageVersionId: claimedHomepageVersionId.value,
      properties: {
        eventName,
        videoAssetId: videoAssetId.value,
        placement: placement.value,
        ...(contentItemId.value ? { contentItemId: contentItemId.value } : {}),
      },
    },
  };
}

function parseOutboundWire(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<{
  properties: Extract<AnalyticsWireProperties, { eventName: "ARTICLE_OUTBOUND_CLICK" }>;
  claimedPublishedVersionId?: string;
}> {
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
  const claimedPublishedVersionId = optionalUuid(properties.publishedVersionId);
  if (!claimedPublishedVersionId.ok) return claimedPublishedVersionId;
  if (typeof properties.destinationHost !== "string") {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  const host = normalizeAnalyticsHostname(properties.destinationHost);
  if (
    host === null ||
    properties.destinationHost.includes("/") ||
    properties.destinationHost.includes("?") ||
    properties.destinationHost.includes("#")
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return {
    ok: true,
    value: {
      claimedPublishedVersionId: claimedPublishedVersionId.value,
      properties: {
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_OUTBOUND_CLICK,
        contentItemId: contentItemId.value,
        destinationHost: host,
      },
    },
  };
}

function parseInternalClickWire(
  properties: Record<string, unknown>,
  surface: AnalyticsSurface,
): AnalyticsDecision<{
  properties: Extract<AnalyticsWireProperties, { eventName: "ARTICLE_INTERNAL_CLICK" }>;
  claimedPublishedVersionId?: string;
}> {
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
  const claimedPublishedVersionId = optionalUuid(properties.publishedVersionId);
  if (!claimedPublishedVersionId.ok) return claimedPublishedVersionId;
  if (
    typeof properties.destinationPath !== "string" ||
    !properties.destinationPath.startsWith("/") ||
    properties.destinationPath.length > ANALYTICS_INTERNAL_PATH_MAX_LENGTH
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }
  return {
    ok: true,
    value: {
      claimedPublishedVersionId: claimedPublishedVersionId.value,
      properties: {
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_INTERNAL_CLICK,
        contentItemId: contentItemId.value,
        destinationPath: properties.destinationPath,
      },
    },
  };
}

/**
 * Public ingestion wire parser. Server-owned fields may appear and are
 * ignored except publishedVersionId/homepageVersionId matching hints.
 */
export function parseAnalyticsWireEvent(input: unknown): AnalyticsDecision<AnalyticsWireEvent> {
  const serializedBytes = Buffer.byteLength(JSON.stringify(input ?? null), "utf8");
  if (serializedBytes > ANALYTICS_EVENT_MAX_BYTES) {
    return { ok: false, code: ANALYTICS_ERROR.EVENT_TOO_LARGE };
  }
  const record = asObject(input);
  if (record === null || rejectUnknownKeys(record, ENVELOPE_KEYS)) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_ENVELOPE };
  }
  if (analyticsEventLeaksSensitiveMaterial(record)) {
    return { ok: false, code: ANALYTICS_ERROR.SENSITIVE_MATERIAL };
  }
  if (typeof record.eventId !== "string" || !isUuid(record.eventId)) {
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
  if (
    typeof record.surface !== "string" ||
    !ANALYTICS_SURFACES.includes(record.surface as AnalyticsSurface)
  ) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_ENVELOPE };
  }
  const occurredAt = parseOccurredAt(record.occurredAt);
  if (!occurredAt.ok) return occurredAt;
  let analyticsContext: string | undefined;
  if (record.analyticsContext !== undefined) {
    if (
      typeof record.analyticsContext !== "string" ||
      record.analyticsContext.length === 0 ||
      record.analyticsContext.length > 2048
    ) {
      return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
    }
    analyticsContext = record.analyticsContext;
  }
  const properties = asObject(record.properties);
  if (properties === null) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
  }

  const eventName = record.eventName;
  const surface = record.surface as AnalyticsSurface;
  let claimedPublishedVersionId: string | undefined;
  let claimedHomepageVersionId: string | null | undefined;
  let parsedProperties: AnalyticsWireProperties;

  switch (eventName) {
    case ANALYTICS_EVENT_NAME.PAGE_VIEW: {
      const parsed = parsePageViewWire(properties, surface);
      if (!parsed.ok) return parsed;
      parsedProperties = parsed.value;
      break;
    }
    case ANALYTICS_EVENT_NAME.ARTICLE_VIEW: {
      const parsed = parseArticleViewWire(properties, surface);
      if (!parsed.ok) return parsed;
      parsedProperties = parsed.value.properties;
      claimedPublishedVersionId = parsed.value.claimedPublishedVersionId;
      break;
    }
    case ANALYTICS_EVENT_NAME.HOMEPAGE_VIEW: {
      const parsed = parseHomepageViewWire(properties, surface);
      if (!parsed.ok) return parsed;
      parsedProperties = parsed.value.properties;
      claimedHomepageVersionId = parsed.value.claimedHomepageVersionId;
      break;
    }
    case ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION:
    case ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK: {
      const parsed = parseHomepageContentWire(eventName, properties, surface);
      if (!parsed.ok) return parsed;
      parsedProperties = parsed.value.properties;
      claimedHomepageVersionId = parsed.value.claimedHomepageVersionId;
      claimedPublishedVersionId = parsed.value.claimedPublishedVersionId;
      break;
    }
    case ANALYTICS_EVENT_NAME.GALLERY_OPEN:
    case ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW:
    case ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE: {
      const parsed = parseGalleryWire(eventName, properties, surface);
      if (!parsed.ok) return parsed;
      parsedProperties = parsed.value.properties;
      claimedPublishedVersionId = parsed.value.claimedPublishedVersionId;
      break;
    }
    case ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION:
    case ANALYTICS_EVENT_NAME.VIDEO_PLAY: {
      const parsed = parseVideoWire(eventName, properties, surface);
      if (!parsed.ok) return parsed;
      parsedProperties = parsed.value.properties;
      claimedPublishedVersionId = parsed.value.claimedPublishedVersionId;
      claimedHomepageVersionId = parsed.value.claimedHomepageVersionId;
      break;
    }
    case ANALYTICS_EVENT_NAME.ARTICLE_OUTBOUND_CLICK: {
      const parsed = parseOutboundWire(properties, surface);
      if (!parsed.ok) return parsed;
      parsedProperties = parsed.value.properties;
      claimedPublishedVersionId = parsed.value.claimedPublishedVersionId;
      break;
    }
    case ANALYTICS_EVENT_NAME.ARTICLE_INTERNAL_CLICK: {
      const parsed = parseInternalClickWire(properties, surface);
      if (!parsed.ok) return parsed;
      parsedProperties = parsed.value.properties;
      claimedPublishedVersionId = parsed.value.claimedPublishedVersionId;
      break;
    }
    default:
      return { ok: false, code: ANALYTICS_ERROR.UNKNOWN_EVENT };
  }

  return {
    ok: true,
    value: {
      eventId: record.eventId,
      eventName,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: occurredAt.value,
      surface,
      claimedPublishedVersionId,
      claimedHomepageVersionId,
      ...(analyticsContext ? { analyticsContext } : {}),
      properties: parsedProperties,
    },
  };
}
