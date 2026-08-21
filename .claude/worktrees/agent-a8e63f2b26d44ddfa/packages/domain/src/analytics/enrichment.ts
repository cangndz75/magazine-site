import type { PublicLegalNoticeKind } from "../public-legal";
import type { PublicArticleWithdrawalKind } from "../public-legal";
import type { VideoProvider } from "../editorial-video";
import type { AnalyticsConsentState } from "./policy";
import { ANALYTICS_TAXONOMY_VERSION } from "./policy";
import { persistentAnalyticsIdentityAllowed } from "./events";
import type { AnalyticsEvent } from "./events";
import {
  classifyAnalyticsTrafficKind,
  classifyAnalyticsTrafficSource,
  normalizeAnalyticsHostname,
  type AnalyticsTrafficSignals,
} from "./traffic";
import { ANALYTICS_ERROR, type AnalyticsDecision } from "./validation";
import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_HOMEPAGE_SLOT_PLACEMENTS,
  ANALYTICS_PLACEMENT,
  ANALYTICS_SURFACE,
  type AnalyticsAppEnv,
  type AnalyticsPlacement,
} from "./taxonomy";
import type { AnalyticsWireEvent } from "./wire";

export type AnalyticsIngestionContext = {
  receivedAt: Date;
  appEnv: AnalyticsAppEnv;
  consentState: AnalyticsConsentState;
  trustedSiteOrigin: string;
  referrerUrl?: string | null;
  trafficSignals: AnalyticsTrafficSignals;
  anonymousSessionId?: string | null;
  analyticsContextSigningKey?: string | null;
};

export type AnalyticsEnrichmentSnapshot =
  | {
      type: "ARTICLE_LIVE";
      contentItemId: string;
      publishedVersionId: string;
      publicSlug: string;
      primaryCategoryId?: string;
      authorIds?: readonly string[];
      publicLegalNoticeKind?: PublicLegalNoticeKind;
    }
  | {
      type: "WITHDRAWN_SHELL";
      contentItemId: string;
      publicSlug: string;
      withdrawalKind: PublicArticleWithdrawalKind;
    }
  | {
      type: "HOMEPAGE_VIEW";
      homepageVersionId: string | null;
    }
  | {
      type: "HOMEPAGE_SLOT";
      homepageVersionId: string;
      contentItemId: string;
      publishedVersionId: string;
      placement: AnalyticsPlacement;
      position: number;
    }
  | {
      type: "HOMEPAGE_FALLBACK";
      homepageVersionId: null;
      contentItemId: string;
      publishedVersionId: string;
      placement: typeof ANALYTICS_PLACEMENT.RECENCY_FALLBACK;
      position: number;
    }
  | {
      type: "HOMEPAGE_CONVERSATION";
      homepageVersionId: string | null;
      contentItemId: string;
      publishedVersionId: string;
      position: number;
    }
  | {
      type: "GALLERY";
      contentItemId: string;
      publishedVersionId: string;
      mediaId: string;
      galleryPosition: number;
    }
  | {
      type: "VIDEO_ARTICLE";
      videoAssetId: string;
      provider: VideoProvider;
      contentItemId: string;
      publishedVersionId: string;
    }
  | {
      type: "VIDEO_HOMEPAGE";
      videoAssetId: string;
      provider: VideoProvider;
      homepageVersionId: string;
    }
  | {
      type: "ARTICLE_CLICK";
      contentItemId: string;
      publishedVersionId: string;
    }
  | {
      type: "OTHER_PUBLIC";
    };

function claimedMatches(
  claimed: string | null | undefined,
  actual: string | null,
): boolean {
  if (claimed === undefined) {
    return true;
  }
  return claimed === actual;
}

function envelope(
  wire: AnalyticsWireEvent,
  context: AnalyticsIngestionContext,
): Omit<AnalyticsEvent, "eventName" | "properties"> & { eventName: AnalyticsEvent["eventName"] } {
  const trafficKind = classifyAnalyticsTrafficKind({
    appEnv: context.appEnv,
    signals: context.trafficSignals,
  });
  const classified = classifyAnalyticsTrafficSource({
    referrerUrl: context.referrerUrl,
    trustedSiteOrigin: context.trustedSiteOrigin,
  });
  const sessionId = persistentAnalyticsIdentityAllowed(context.consentState)
    ? context.anonymousSessionId
    : null;

  return {
    eventId: wire.eventId,
    eventName: wire.eventName,
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    occurredAt: wire.occurredAt,
    receivedAt: context.receivedAt,
    anonymousVisitorId: null,
    anonymousSessionId: sessionId ?? null,
    trafficKind,
    trafficSource: classified.source,
    referrerHost: classified.referrerHost,
    surface: wire.surface,
  };
}

/**
 * Apply server-authoritative dimensions. Client category/author/provider/
 * trafficKind never become stored facts.
 */
export function enrichAnalyticsEvent(
  wire: AnalyticsWireEvent,
  context: AnalyticsIngestionContext,
  snapshot: AnalyticsEnrichmentSnapshot,
): AnalyticsDecision<AnalyticsEvent> {
  const base = envelope(wire, context);

  switch (wire.eventName) {
    case ANALYTICS_EVENT_NAME.ARTICLE_VIEW: {
      if (snapshot.type !== "ARTICLE_LIVE") {
        return { ok: false, code: ANALYTICS_ERROR.NOT_PUBLIC };
      }
      if (wire.properties.eventName !== "ARTICLE_VIEW") {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      if (wire.properties.contentItemId !== snapshot.contentItemId) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (!claimedMatches(wire.claimedPublishedVersionId, snapshot.publishedVersionId)) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (
        wire.properties.publicSlug !== undefined &&
        wire.properties.publicSlug !== snapshot.publicSlug
      ) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (wire.surface !== ANALYTICS_SURFACE.ARTICLE) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      return {
        ok: true,
        value: {
          ...base,
          eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
          surface: ANALYTICS_SURFACE.ARTICLE,
          properties: {
            contentItemId: snapshot.contentItemId,
            publishedVersionId: snapshot.publishedVersionId,
            publicSlug: snapshot.publicSlug,
            ...(snapshot.primaryCategoryId
              ? { primaryCategoryId: snapshot.primaryCategoryId }
              : {}),
            ...(snapshot.authorIds && snapshot.authorIds.length > 0
              ? { authorIds: [...snapshot.authorIds] }
              : {}),
            ...(snapshot.publicLegalNoticeKind
              ? { publicLegalNoticeKind: snapshot.publicLegalNoticeKind }
              : {}),
            ...(wire.properties.utm ? { utm: wire.properties.utm } : {}),
          },
        },
      };
    }
    case ANALYTICS_EVENT_NAME.PAGE_VIEW: {
      if (wire.surface === ANALYTICS_SURFACE.WITHDRAWN_SHELL) {
        if (snapshot.type !== "WITHDRAWN_SHELL") {
          return { ok: false, code: ANALYTICS_ERROR.NOT_PUBLIC };
        }
        if (wire.properties.eventName !== "PAGE_VIEW") {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
        }
        if (
          wire.properties.contentItemId !== undefined &&
          wire.properties.contentItemId !== snapshot.contentItemId
        ) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        return {
          ok: true,
          value: {
            ...base,
            eventName: ANALYTICS_EVENT_NAME.PAGE_VIEW,
            surface: ANALYTICS_SURFACE.WITHDRAWN_SHELL,
            properties: {
              contentItemId: snapshot.contentItemId,
              publicSlug: snapshot.publicSlug,
              withdrawalKind: snapshot.withdrawalKind,
              ...(wire.properties.utm ? { utm: wire.properties.utm } : {}),
            },
          },
        };
      }
      if (snapshot.type !== "OTHER_PUBLIC") {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (wire.properties.eventName !== "PAGE_VIEW") {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      return {
        ok: true,
        value: {
          ...base,
          eventName: ANALYTICS_EVENT_NAME.PAGE_VIEW,
          surface: ANALYTICS_SURFACE.OTHER_PUBLIC,
          properties: {
            ...(wire.properties.contentItemId
              ? { contentItemId: wire.properties.contentItemId }
              : {}),
            ...(wire.properties.publicSlug
              ? { publicSlug: wire.properties.publicSlug }
              : {}),
            ...(wire.properties.utm ? { utm: wire.properties.utm } : {}),
          },
        },
      };
    }
    case ANALYTICS_EVENT_NAME.HOMEPAGE_VIEW: {
      if (snapshot.type !== "HOMEPAGE_VIEW") {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (wire.properties.eventName !== "HOMEPAGE_VIEW") {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      if (!claimedMatches(wire.claimedHomepageVersionId, snapshot.homepageVersionId)) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      return {
        ok: true,
        value: {
          ...base,
          eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_VIEW,
          surface: ANALYTICS_SURFACE.HOMEPAGE,
          properties: {
            homepageVersionId: snapshot.homepageVersionId,
            ...(wire.properties.utm ? { utm: wire.properties.utm } : {}),
          },
        },
      };
    }
    case ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION:
    case ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK: {
      if (
        wire.properties.eventName !== "HOMEPAGE_CONTENT_IMPRESSION" &&
        wire.properties.eventName !== "HOMEPAGE_CONTENT_CLICK"
      ) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      const isSlot = (
        ANALYTICS_HOMEPAGE_SLOT_PLACEMENTS as readonly string[]
      ).includes(wire.properties.placement);
      if (isSlot) {
        if (snapshot.type !== "HOMEPAGE_SLOT") {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        if (
          snapshot.contentItemId !== wire.properties.contentItemId ||
          snapshot.placement !== wire.properties.placement ||
          snapshot.position !== wire.properties.position
        ) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        if (!claimedMatches(wire.claimedHomepageVersionId, snapshot.homepageVersionId)) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        if (!claimedMatches(wire.claimedPublishedVersionId, snapshot.publishedVersionId)) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        return {
          ok: true,
          value: {
            ...base,
            eventName: wire.eventName,
            surface: ANALYTICS_SURFACE.HOMEPAGE,
            properties: {
              contentItemId: snapshot.contentItemId,
              publishedVersionId: snapshot.publishedVersionId,
              homepageVersionId: snapshot.homepageVersionId,
              placement: snapshot.placement,
              position: snapshot.position,
              pageViewContextId: wire.properties.pageViewContextId,
            },
          },
        };
      }
      if (wire.properties.placement === ANALYTICS_PLACEMENT.RECENCY_FALLBACK) {
        if (snapshot.type !== "HOMEPAGE_FALLBACK") {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        if (
          snapshot.contentItemId !== wire.properties.contentItemId ||
          snapshot.position !== wire.properties.position
        ) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        return {
          ok: true,
          value: {
            ...base,
            eventName: wire.eventName,
            surface: ANALYTICS_SURFACE.HOMEPAGE,
            properties: {
              contentItemId: snapshot.contentItemId,
              publishedVersionId: snapshot.publishedVersionId,
              homepageVersionId: null,
              placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
              position: snapshot.position,
              pageViewContextId: wire.properties.pageViewContextId,
            },
          },
        };
      }
      if (wire.properties.placement !== ANALYTICS_PLACEMENT.CONVERSATION) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (snapshot.type !== "HOMEPAGE_CONVERSATION") {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (
        snapshot.contentItemId !== wire.properties.contentItemId ||
        snapshot.position !== wire.properties.position
      ) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (!claimedMatches(wire.claimedPublishedVersionId, snapshot.publishedVersionId)) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      return {
        ok: true,
        value: {
          ...base,
          eventName: wire.eventName,
          surface: ANALYTICS_SURFACE.HOMEPAGE,
          properties: {
            contentItemId: snapshot.contentItemId,
            publishedVersionId: snapshot.publishedVersionId,
            homepageVersionId: snapshot.homepageVersionId,
            placement: ANALYTICS_PLACEMENT.CONVERSATION,
            position: snapshot.position,
            pageViewContextId: wire.properties.pageViewContextId,
          },
        },
      };
    }
    case ANALYTICS_EVENT_NAME.GALLERY_OPEN:
    case ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW:
    case ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE: {
      if (snapshot.type !== "GALLERY") {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (
        wire.properties.eventName !== "GALLERY_OPEN" &&
        wire.properties.eventName !== "GALLERY_IMAGE_VIEW" &&
        wire.properties.eventName !== "GALLERY_NAVIGATE"
      ) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      if (
        snapshot.contentItemId !== wire.properties.contentItemId ||
        snapshot.mediaId !== wire.properties.mediaId ||
        snapshot.galleryPosition !== wire.properties.galleryPosition
      ) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (!claimedMatches(wire.claimedPublishedVersionId, snapshot.publishedVersionId)) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      return {
        ok: true,
        value: {
          ...base,
          eventName: wire.eventName,
          surface: ANALYTICS_SURFACE.ARTICLE,
          properties: {
            contentItemId: snapshot.contentItemId,
            publishedVersionId: snapshot.publishedVersionId,
            mediaId: snapshot.mediaId,
            galleryPosition: snapshot.galleryPosition,
            ...("navigationMethod" in wire.properties && wire.properties.navigationMethod
              ? { navigationMethod: wire.properties.navigationMethod }
              : {}),
          },
        },
      };
    }
    case ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION:
    case ANALYTICS_EVENT_NAME.VIDEO_PLAY: {
      if (
        wire.properties.eventName !== "VIDEO_IMPRESSION" &&
        wire.properties.eventName !== "VIDEO_PLAY"
      ) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      if (wire.properties.placement === ANALYTICS_PLACEMENT.ARTICLE_VIDEO) {
        if (snapshot.type !== "VIDEO_ARTICLE") {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        if (
          snapshot.videoAssetId !== wire.properties.videoAssetId ||
          snapshot.contentItemId !== wire.properties.contentItemId
        ) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        if (!claimedMatches(wire.claimedPublishedVersionId, snapshot.publishedVersionId)) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        return {
          ok: true,
          value: {
            ...base,
            eventName: wire.eventName,
            surface: ANALYTICS_SURFACE.ARTICLE,
            properties: {
              videoAssetId: snapshot.videoAssetId,
              provider: snapshot.provider,
              contentItemId: snapshot.contentItemId,
              publishedVersionId: snapshot.publishedVersionId,
              placement: ANALYTICS_PLACEMENT.ARTICLE_VIDEO,
            },
          },
        };
      }
      if (snapshot.type !== "VIDEO_HOMEPAGE") {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (snapshot.videoAssetId !== wire.properties.videoAssetId) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (!claimedMatches(wire.claimedHomepageVersionId, snapshot.homepageVersionId)) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      return {
        ok: true,
        value: {
          ...base,
          eventName: wire.eventName,
          surface: ANALYTICS_SURFACE.HOMEPAGE,
          properties: {
            videoAssetId: snapshot.videoAssetId,
            provider: snapshot.provider,
            homepageVersionId: snapshot.homepageVersionId,
            placement: ANALYTICS_PLACEMENT.HOMEPAGE_VIDEO,
          },
        },
      };
    }
    case ANALYTICS_EVENT_NAME.ARTICLE_OUTBOUND_CLICK: {
      if (snapshot.type !== "ARTICLE_CLICK") {
        return { ok: false, code: ANALYTICS_ERROR.NOT_PUBLIC };
      }
      if (wire.properties.eventName !== "ARTICLE_OUTBOUND_CLICK") {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      if (wire.properties.contentItemId !== snapshot.contentItemId) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (!claimedMatches(wire.claimedPublishedVersionId, snapshot.publishedVersionId)) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      const host = normalizeAnalyticsHostname(wire.properties.destinationHost);
      if (host === null || wire.properties.destinationHost.includes("/") ) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      return {
        ok: true,
        value: {
          ...base,
          eventName: ANALYTICS_EVENT_NAME.ARTICLE_OUTBOUND_CLICK,
          surface: ANALYTICS_SURFACE.ARTICLE,
          properties: {
            contentItemId: snapshot.contentItemId,
            publishedVersionId: snapshot.publishedVersionId,
            destinationHost: host,
          },
        },
      };
    }
    case ANALYTICS_EVENT_NAME.ARTICLE_INTERNAL_CLICK: {
      if (snapshot.type !== "ARTICLE_CLICK") {
        return { ok: false, code: ANALYTICS_ERROR.NOT_PUBLIC };
      }
      if (wire.properties.eventName !== "ARTICLE_INTERNAL_CLICK") {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      if (wire.properties.contentItemId !== snapshot.contentItemId) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (!claimedMatches(wire.claimedPublishedVersionId, snapshot.publishedVersionId)) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      return {
        ok: true,
        value: {
          ...base,
          eventName: ANALYTICS_EVENT_NAME.ARTICLE_INTERNAL_CLICK,
          surface: ANALYTICS_SURFACE.ARTICLE,
          properties: {
            contentItemId: snapshot.contentItemId,
            publishedVersionId: snapshot.publishedVersionId,
            destinationPath: wire.properties.destinationPath,
          },
        },
      };
    }
    default:
      return { ok: false, code: ANALYTICS_ERROR.UNKNOWN_EVENT };
  }
}
