import type { PublicArticleWithdrawalKind } from "../public-legal";
import type { PublicLegalNoticeKind } from "../public-legal";
import type { VideoProvider } from "../editorial-video";
import type { AnalyticsConsentState } from "./policy";
import type {
  AnalyticsEventName,
  AnalyticsGalleryNavigationMethod,
  AnalyticsPlacement,
  AnalyticsSurface,
  AnalyticsTrafficKind,
  AnalyticsTrafficSource,
} from "./taxonomy";
import { ANALYTICS_TAXONOMY_VERSION } from "./policy";
import type { AnalyticsUtmFields } from "./traffic";

export type AnalyticsEventEnvelope = {
  eventId: string;
  eventName: AnalyticsEventName;
  schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
  occurredAt: Date;
  receivedAt: Date;
  anonymousVisitorId: null;
  anonymousSessionId: string | null;
  trafficKind: AnalyticsTrafficKind;
  trafficSource: AnalyticsTrafficSource;
  referrerHost: string | null;
  surface: AnalyticsSurface;
};

export type PageViewProperties = {
  contentItemId?: string;
  publicSlug?: string;
  withdrawalKind?: PublicArticleWithdrawalKind;
  utm?: AnalyticsUtmFields;
};

export type ArticleViewProperties = {
  contentItemId: string;
  publishedVersionId: string;
  publicSlug: string;
  primaryCategoryId?: string;
  authorIds?: readonly string[];
  publicLegalNoticeKind?: PublicLegalNoticeKind;
  utm?: AnalyticsUtmFields;
};

export type HomepageViewProperties = {
  homepageVersionId: string | null;
  utm?: AnalyticsUtmFields;
};

export type HomepageContentInteractionProperties = {
  contentItemId: string;
  publishedVersionId: string;
  homepageVersionId: string | null;
  placement: AnalyticsPlacement;
  position: number;
  pageViewContextId: string;
};

export type GalleryEventProperties = {
  contentItemId: string;
  publishedVersionId: string;
  mediaId: string;
  galleryPosition: number;
  navigationMethod?: AnalyticsGalleryNavigationMethod;
};

export type VideoEventProperties = {
  videoAssetId: string;
  provider: VideoProvider;
  contentItemId?: string;
  publishedVersionId?: string;
  homepageVersionId?: string;
  placement: AnalyticsPlacement;
};

export type ArticleOutboundClickProperties = {
  contentItemId: string;
  publishedVersionId: string;
  destinationHost: string;
};

export type ArticleInternalClickProperties = {
  contentItemId: string;
  publishedVersionId: string;
  destinationPath: string;
};

export type AnalyticsEvent =
  | (AnalyticsEventEnvelope & {
      eventName: "PAGE_VIEW";
      properties: PageViewProperties;
    })
  | (AnalyticsEventEnvelope & {
      eventName: "ARTICLE_VIEW";
      properties: ArticleViewProperties;
    })
  | (AnalyticsEventEnvelope & {
      eventName: "HOMEPAGE_VIEW";
      properties: HomepageViewProperties;
    })
  | (AnalyticsEventEnvelope & {
      eventName: "HOMEPAGE_CONTENT_IMPRESSION";
      properties: HomepageContentInteractionProperties;
    })
  | (AnalyticsEventEnvelope & {
      eventName: "HOMEPAGE_CONTENT_CLICK";
      properties: HomepageContentInteractionProperties;
    })
  | (AnalyticsEventEnvelope & {
      eventName: "GALLERY_OPEN";
      properties: GalleryEventProperties;
    })
  | (AnalyticsEventEnvelope & {
      eventName: "GALLERY_IMAGE_VIEW";
      properties: GalleryEventProperties;
    })
  | (AnalyticsEventEnvelope & {
      eventName: "GALLERY_NAVIGATE";
      properties: GalleryEventProperties;
    })
  | (AnalyticsEventEnvelope & {
      eventName: "VIDEO_IMPRESSION";
      properties: VideoEventProperties;
    })
  | (AnalyticsEventEnvelope & {
      eventName: "VIDEO_PLAY";
      properties: VideoEventProperties;
    })
  | (AnalyticsEventEnvelope & {
      eventName: "ARTICLE_OUTBOUND_CLICK";
      properties: ArticleOutboundClickProperties;
    })
  | (AnalyticsEventEnvelope & {
      eventName: "ARTICLE_INTERNAL_CLICK";
      properties: ArticleInternalClickProperties;
    });

export type AnalyticsStoredProperties = AnalyticsEvent["properties"];

export type AnalyticsRawEventRecord = {
  eventId: string;
  schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
  eventName: AnalyticsEventName;
  occurredAt: Date;
  receivedAt: Date;
  anonymousSessionId: string | null;
  anonymousVisitorId: null;
  trafficKind: AnalyticsTrafficKind;
  trafficSource: AnalyticsTrafficSource;
  referrerHost: string | null;
  contentItemId: string | null;
  publishedVersionId: string | null;
  publicSlug: string | null;
  surface: AnalyticsSurface;
  placement: AnalyticsPlacement | null;
  homepageVersionId: string | null;
  position: number | null;
  mediaId: string | null;
  videoAssetId: string | null;
  primaryCategoryId: string | null;
  authorIds: string[] | null;
  factFingerprint: string;
  properties: AnalyticsStoredProperties;
};

export type ClientAnalyticsEventInput = {
  eventId: string;
  eventName: AnalyticsEventName;
  schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
  occurredAt: string | Date;
  anonymousSessionId?: string | null;
  surface: AnalyticsSurface;
  properties: Record<string, unknown>;
};

export function persistentAnalyticsIdentityAllowed(
  consentState: AnalyticsConsentState,
): boolean {
  return consentState === "GRANTED";
}

function contentItemIdFrom(event: AnalyticsEvent): string | null {
  if ("contentItemId" in event.properties && event.properties.contentItemId) {
    return event.properties.contentItemId;
  }
  return null;
}

function publishedVersionIdFrom(event: AnalyticsEvent): string | null {
  if (
    "publishedVersionId" in event.properties &&
    event.properties.publishedVersionId
  ) {
    return event.properties.publishedVersionId;
  }
  return null;
}

function publicSlugFrom(event: AnalyticsEvent): string | null {
  if ("publicSlug" in event.properties && event.properties.publicSlug) {
    return event.properties.publicSlug;
  }
  return null;
}

function placementFrom(event: AnalyticsEvent): AnalyticsPlacement | null {
  if ("placement" in event.properties) {
    return event.properties.placement;
  }
  return null;
}

function homepageVersionIdFrom(event: AnalyticsEvent): string | null {
  if (
    "homepageVersionId" in event.properties &&
    event.properties.homepageVersionId
  ) {
    return event.properties.homepageVersionId;
  }
  return null;
}

function positionFrom(event: AnalyticsEvent): number | null {
  if ("position" in event.properties) {
    return event.properties.position;
  }
  if ("galleryPosition" in event.properties) {
    return event.properties.galleryPosition;
  }
  return null;
}

function mediaIdFrom(event: AnalyticsEvent): string | null {
  if ("mediaId" in event.properties) {
    return event.properties.mediaId;
  }
  return null;
}

function videoAssetIdFrom(event: AnalyticsEvent): string | null {
  if ("videoAssetId" in event.properties) {
    return event.properties.videoAssetId;
  }
  return null;
}

function primaryCategoryIdFrom(event: AnalyticsEvent): string | null {
  if ("primaryCategoryId" in event.properties && event.properties.primaryCategoryId) {
    return event.properties.primaryCategoryId;
  }
  return null;
}

function authorIdsFrom(event: AnalyticsEvent): string[] | null {
  if ("authorIds" in event.properties && event.properties.authorIds) {
    return [...event.properties.authorIds];
  }
  return null;
}

export function toAnalyticsRawEventRecord(
  event: AnalyticsEvent,
  factFingerprint: string,
): AnalyticsRawEventRecord {
  return {
    eventId: event.eventId,
    schemaVersion: event.schemaVersion,
    eventName: event.eventName,
    occurredAt: event.occurredAt,
    receivedAt: event.receivedAt,
    anonymousSessionId: event.anonymousSessionId,
    anonymousVisitorId: null,
    trafficKind: event.trafficKind,
    trafficSource: event.trafficSource,
    referrerHost: event.referrerHost,
    contentItemId: contentItemIdFrom(event),
    publishedVersionId: publishedVersionIdFrom(event),
    publicSlug: publicSlugFrom(event),
    surface: event.surface,
    placement: placementFrom(event),
    homepageVersionId: homepageVersionIdFrom(event),
    position: positionFrom(event),
    mediaId: mediaIdFrom(event),
    videoAssetId: videoAssetIdFrom(event),
    primaryCategoryId: primaryCategoryIdFrom(event),
    authorIds: authorIdsFrom(event),
    factFingerprint,
    properties: event.properties,
  };
}
