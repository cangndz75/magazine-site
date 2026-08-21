import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_SURFACE,
  ANALYTICS_TAXONOMY_VERSION,
  selectedAnalyticsUtmFromSearch,
  type AnalyticsClientEvent,
  type ArticleViewClientEvent,
  type GalleryImageViewClientEvent,
  type GalleryNavigateClientEvent,
  type GalleryOpenClientEvent,
  type HomepageContentClickClientEvent,
  type HomepageContentImpressionClientEvent,
  type HomepageViewClientEvent,
  type VideoImpressionClientEvent,
  type WithdrawnPageViewClientEvent,
} from "@magazine/domain/analytics-client";
import { deliverAnalyticsEvent, type AnalyticsTransport } from "./transport";

export type AnalyticsTracker = {
  trackAnalyticsEvent: (
    event: AnalyticsClientEvent,
    options?: { surviveNavigation?: boolean },
  ) => void;
  trackArticleView: (input: ArticleViewInput) => void;
  trackHomepageView: (input: HomepageViewInput) => void;
  trackWithdrawnPageView: (input: WithdrawnPageViewInput) => void;
  trackHomepageImpression: (input: HomepagePlacementInput) => void;
  trackHomepageClick: (input: HomepagePlacementInput) => void;
  trackGalleryOpen: (input: GalleryIdentityInput) => void;
  trackGalleryImageView: (input: GalleryIdentityInput) => void;
  trackGalleryNavigate: (
    input: GalleryIdentityInput & { navigationMethod: GalleryNavigateClientEvent["properties"]["navigationMethod"] },
  ) => void;
  trackVideoImpression: (input: VideoImpressionInput) => void;
};

export type ArticleViewInput = {
  contentItemId: string;
  publicSlug?: string;
  analyticsContext: string;
};

export type HomepageViewInput = {
  homepageVersionId?: string | null;
  analyticsContext: string;
};

export type WithdrawnPageViewInput = {
  contentItemId: string;
  publicSlug?: string;
  withdrawalKind?: "RETRACTION" | "TAKEDOWN";
};

export type HomepagePlacementInput = {
  contentItemId: string;
  homepageVersionId?: string;
  placement: HomepageContentImpressionClientEvent["properties"]["placement"];
  position: number;
  pageViewContextId: string;
  analyticsContext: string;
};

export type GalleryIdentityInput = {
  contentItemId: string;
  mediaId: string;
  galleryPosition: number;
  analyticsContext: string;
};

export type VideoImpressionInput = {
  videoAssetId: string;
  placement: VideoImpressionClientEvent["properties"]["placement"];
  contentItemId?: string;
  homepageVersionId?: string;
  analyticsContext: string;
};

type TrackerOptions = {
  transport?: AnalyticsTransport;
  now?: () => Date;
  createEventId?: () => string;
  search?: () => string;
};

function createEventId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "00000000-0000-4000-8000-000000000000";
}

function currentSearch(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.search;
}

function envelope<Event extends AnalyticsClientEvent>(
  input: Omit<Event, "eventId" | "schemaVersion" | "occurredAt">,
  options: { eventId: string; occurredAt: string; analyticsContext?: string },
): Event {
  return {
    ...input,
    ...(options.analyticsContext
      ? { analyticsContext: options.analyticsContext }
      : {}),
    eventId: options.eventId,
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    occurredAt: options.occurredAt,
  } as Event;
}

function dispatch(
  transport: AnalyticsTransport,
  event: AnalyticsClientEvent,
  options?: { surviveNavigation?: boolean },
): void {
  try {
    const result = transport(event, options);
    if (result && typeof result.then === "function") {
      void result.catch(() => undefined);
    }
  } catch {
    return;
  }
}

export function createAnalyticsTracker(options: TrackerOptions = {}): AnalyticsTracker {
  const transport = options.transport ?? deliverAnalyticsEvent;
  const now = options.now ?? (() => new Date());
  const nextEventId = options.createEventId ?? createEventId;
  const search = options.search ?? currentSearch;

  function trackAnalyticsEvent(
    event: AnalyticsClientEvent,
    delivery?: { surviveNavigation?: boolean },
  ): void {
    dispatch(transport, event, delivery);
  }

  function viewUtm() {
    return selectedAnalyticsUtmFromSearch(search());
  }

  return {
    trackAnalyticsEvent,
    trackArticleView(input) {
      const utm = viewUtm();
      trackAnalyticsEvent(
        envelope<ArticleViewClientEvent>(
          {
            eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
            surface: ANALYTICS_SURFACE.ARTICLE,
            properties: {
              contentItemId: input.contentItemId,
              ...(input.publicSlug ? { publicSlug: input.publicSlug } : {}),
              ...(utm ? { utm } : {}),
            },
          },
          {
            eventId: nextEventId(),
            occurredAt: now().toISOString(),
            analyticsContext: input.analyticsContext,
          },
        ),
      );
    },
    trackHomepageView(input) {
      const utm = viewUtm();
      trackAnalyticsEvent(
        envelope<HomepageViewClientEvent>(
          {
            eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_VIEW,
            surface: ANALYTICS_SURFACE.HOMEPAGE,
            properties: {
              ...(input.homepageVersionId !== undefined
                ? { homepageVersionId: input.homepageVersionId }
                : {}),
              ...(utm ? { utm } : {}),
            },
          },
          {
            eventId: nextEventId(),
            occurredAt: now().toISOString(),
            analyticsContext: input.analyticsContext,
          },
        ),
      );
    },
    trackWithdrawnPageView(input) {
      const utm = viewUtm();
      trackAnalyticsEvent(
        envelope<WithdrawnPageViewClientEvent>(
          {
            eventName: ANALYTICS_EVENT_NAME.PAGE_VIEW,
            surface: ANALYTICS_SURFACE.WITHDRAWN_SHELL,
            properties: {
              contentItemId: input.contentItemId,
              ...(input.publicSlug ? { publicSlug: input.publicSlug } : {}),
              ...(input.withdrawalKind ? { withdrawalKind: input.withdrawalKind } : {}),
              ...(utm ? { utm } : {}),
            },
          },
          {
            eventId: nextEventId(),
            occurredAt: now().toISOString(),
          },
        ),
      );
    },
    trackHomepageImpression(input) {
      trackAnalyticsEvent(
        envelope<HomepageContentImpressionClientEvent>(
          {
            eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
            surface: ANALYTICS_SURFACE.HOMEPAGE,
            properties: {
              contentItemId: input.contentItemId,
              placement: input.placement,
              position: input.position,
              pageViewContextId: input.pageViewContextId,
              ...(input.homepageVersionId ? { homepageVersionId: input.homepageVersionId } : {}),
            },
          },
          {
            eventId: nextEventId(),
            occurredAt: now().toISOString(),
            analyticsContext: input.analyticsContext,
          },
        ),
      );
    },
    trackHomepageClick(input) {
      trackAnalyticsEvent(
        envelope<HomepageContentClickClientEvent>(
          {
            eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK,
            surface: ANALYTICS_SURFACE.HOMEPAGE,
            properties: {
              contentItemId: input.contentItemId,
              placement: input.placement,
              position: input.position,
              pageViewContextId: input.pageViewContextId,
              ...(input.homepageVersionId ? { homepageVersionId: input.homepageVersionId } : {}),
            },
          },
          {
            eventId: nextEventId(),
            occurredAt: now().toISOString(),
            analyticsContext: input.analyticsContext,
          },
        ),
        { surviveNavigation: true },
      );
    },
    trackGalleryOpen(input) {
      trackAnalyticsEvent(
        envelope<GalleryOpenClientEvent>(
          {
            eventName: ANALYTICS_EVENT_NAME.GALLERY_OPEN,
            surface: ANALYTICS_SURFACE.ARTICLE,
            properties: {
              contentItemId: input.contentItemId,
              mediaId: input.mediaId,
              galleryPosition: input.galleryPosition,
            },
          },
          {
            eventId: nextEventId(),
            occurredAt: now().toISOString(),
            analyticsContext: input.analyticsContext,
          },
        ),
      );
    },
    trackGalleryImageView(input) {
      trackAnalyticsEvent(
        envelope<GalleryImageViewClientEvent>(
          {
            eventName: ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW,
            surface: ANALYTICS_SURFACE.ARTICLE,
            properties: {
              contentItemId: input.contentItemId,
              mediaId: input.mediaId,
              galleryPosition: input.galleryPosition,
            },
          },
          {
            eventId: nextEventId(),
            occurredAt: now().toISOString(),
            analyticsContext: input.analyticsContext,
          },
        ),
      );
    },
    trackGalleryNavigate(input) {
      trackAnalyticsEvent(
        envelope<GalleryNavigateClientEvent>(
          {
            eventName: ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE,
            surface: ANALYTICS_SURFACE.ARTICLE,
            properties: {
              contentItemId: input.contentItemId,
              mediaId: input.mediaId,
              galleryPosition: input.galleryPosition,
              navigationMethod: input.navigationMethod,
            },
          },
          {
            eventId: nextEventId(),
            occurredAt: now().toISOString(),
            analyticsContext: input.analyticsContext,
          },
        ),
      );
    },
    trackVideoImpression(input) {
      trackAnalyticsEvent(
        envelope<VideoImpressionClientEvent>(
          {
            eventName: ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION,
            surface:
              input.placement === "HOMEPAGE_VIDEO"
                ? ANALYTICS_SURFACE.HOMEPAGE
                : ANALYTICS_SURFACE.ARTICLE,
            properties: {
              videoAssetId: input.videoAssetId,
              placement: input.placement,
              ...(input.contentItemId ? { contentItemId: input.contentItemId } : {}),
              ...(input.homepageVersionId ? { homepageVersionId: input.homepageVersionId } : {}),
            },
          },
          {
            eventId: nextEventId(),
            occurredAt: now().toISOString(),
            analyticsContext: input.analyticsContext,
          },
        ),
      );
    },
  };
}

let activeTracker = createAnalyticsTracker();

export function getAnalyticsTracker(): AnalyticsTracker {
  return activeTracker;
}

export function setAnalyticsTrackerForTests(tracker: AnalyticsTracker | null): void {
  activeTracker = tracker ?? createAnalyticsTracker();
}

export const publicAnalytics = {
  trackAnalyticsEvent: (
    event: AnalyticsClientEvent,
    options?: { surviveNavigation?: boolean },
  ) => getAnalyticsTracker().trackAnalyticsEvent(event, options),
  trackArticleView: (input: ArticleViewInput) => getAnalyticsTracker().trackArticleView(input),
  trackHomepageView: (input: HomepageViewInput) => getAnalyticsTracker().trackHomepageView(input),
  trackWithdrawnPageView: (input: WithdrawnPageViewInput) =>
    getAnalyticsTracker().trackWithdrawnPageView(input),
  trackHomepageImpression: (input: HomepagePlacementInput) =>
    getAnalyticsTracker().trackHomepageImpression(input),
  trackHomepageClick: (input: HomepagePlacementInput) =>
    getAnalyticsTracker().trackHomepageClick(input),
  trackGalleryOpen: (input: GalleryIdentityInput) => getAnalyticsTracker().trackGalleryOpen(input),
  trackGalleryImageView: (input: GalleryIdentityInput) =>
    getAnalyticsTracker().trackGalleryImageView(input),
  trackGalleryNavigate: (
    input: GalleryIdentityInput & {
      navigationMethod: GalleryNavigateClientEvent["properties"]["navigationMethod"];
    },
  ) => getAnalyticsTracker().trackGalleryNavigate(input),
  trackVideoImpression: (input: VideoImpressionInput) =>
    getAnalyticsTracker().trackVideoImpression(input),
};
