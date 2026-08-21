import {
  HOMEPAGE_SLOT_KEY,
  HOMEPAGE_SLOT_KEYS,
  type HomepageSlotKey,
} from "../homepage-builder";
import { ARTICLE_GALLERY_MAX_ITEMS } from "../article-gallery";
import { PUBLIC_HOMEPAGE_CONVERSATION_LIMIT } from "../homepage-conversation";
import { ANALYTICS_TAXONOMY_VERSION } from "./policy";

export const ANALYTICS_EVENT_NAME = {
  PAGE_VIEW: "PAGE_VIEW",
  ARTICLE_VIEW: "ARTICLE_VIEW",
  HOMEPAGE_VIEW: "HOMEPAGE_VIEW",
  HOMEPAGE_CONTENT_IMPRESSION: "HOMEPAGE_CONTENT_IMPRESSION",
  HOMEPAGE_CONTENT_CLICK: "HOMEPAGE_CONTENT_CLICK",
  GALLERY_OPEN: "GALLERY_OPEN",
  GALLERY_IMAGE_VIEW: "GALLERY_IMAGE_VIEW",
  GALLERY_NAVIGATE: "GALLERY_NAVIGATE",
  VIDEO_IMPRESSION: "VIDEO_IMPRESSION",
  VIDEO_PLAY: "VIDEO_PLAY",
  ARTICLE_OUTBOUND_CLICK: "ARTICLE_OUTBOUND_CLICK",
  ARTICLE_INTERNAL_CLICK: "ARTICLE_INTERNAL_CLICK",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENT_NAME)[keyof typeof ANALYTICS_EVENT_NAME];

export const ANALYTICS_EVENT_NAMES = Object.values(ANALYTICS_EVENT_NAME);

/**
 * Retired names remain reserved forever so dashboards cannot silently
 * reinterpret a reused label.
 */
export const ANALYTICS_RETIRED_EVENT_NAMES: readonly string[] = [];

export type AnalyticsEventRegistryEntry = {
  schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
  meaning: string;
  retired: false;
};

export const ANALYTICS_EVENT_REGISTRY: Record<
  AnalyticsEventName,
  AnalyticsEventRegistryEntry
> = {
  PAGE_VIEW: {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    meaning:
      "Qualified public route observation that is not a live article view and not a homepage view.",
    retired: false,
  },
  ARTICLE_VIEW: {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    meaning:
      "Canonical public article page observation tied to an authoritative published content version. Not emitted for withdrawn shells.",
    retired: false,
  },
  HOMEPAGE_VIEW: {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    meaning: "Canonical public homepage route observation.",
    retired: false,
  },
  HOMEPAGE_CONTENT_IMPRESSION: {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    meaning:
      "Browser-visible homepage content card meeting the v1 viewport impression policy. Server HTML is not proof of view.",
    retired: false,
  },
  HOMEPAGE_CONTENT_CLICK: {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    meaning: "User click on a homepage content placement.",
    retired: false,
  },
  GALLERY_OPEN: {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    meaning:
      "First explicit user interaction with an article gallery. Initial server render is not an open.",
    retired: false,
  },
  GALLERY_IMAGE_VIEW: {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    meaning:
      "A particular gallery image becomes the current image after user interaction. Initial SSR image is not a view.",
    retired: false,
  },
  GALLERY_NAVIGATE: {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    meaning: "Explicit previous, next, thumbnail, or keyboard gallery navigation.",
    retired: false,
  },
  VIDEO_IMPRESSION: {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    meaning:
      "Browser-visible editorial video embed meeting the v1 viewport impression policy.",
    retired: false,
  },
  VIDEO_PLAY: {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    meaning:
      "Trusted play start of an editorial video. Emission is deferred until a trusted player API exists. Completion and watch-time are not defined.",
    retired: false,
  },
  ARTICLE_OUTBOUND_CLICK: {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    meaning: "User click from an article to an external hostname.",
    retired: false,
  },
  ARTICLE_INTERNAL_CLICK: {
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    meaning: "User click from an article to another path on the trusted public site origin.",
    retired: false,
  },
};

export const ANALYTICS_SURFACE = {
  HOMEPAGE: "HOMEPAGE",
  ARTICLE: "ARTICLE",
  WITHDRAWN_SHELL: "WITHDRAWN_SHELL",
  OTHER_PUBLIC: "OTHER_PUBLIC",
} as const;

export type AnalyticsSurface =
  (typeof ANALYTICS_SURFACE)[keyof typeof ANALYTICS_SURFACE];

export const ANALYTICS_SURFACES = Object.values(ANALYTICS_SURFACE);

export const ANALYTICS_PLACEMENT = {
  LEAD: HOMEPAGE_SLOT_KEY.LEAD,
  SUPPORT_1: HOMEPAGE_SLOT_KEY.SUPPORT_1,
  SUPPORT_2: HOMEPAGE_SLOT_KEY.SUPPORT_2,
  FEATURED_1: HOMEPAGE_SLOT_KEY.FEATURED_1,
  FEATURED_2: HOMEPAGE_SLOT_KEY.FEATURED_2,
  FEATURED_3: HOMEPAGE_SLOT_KEY.FEATURED_3,
  FEATURED_4: HOMEPAGE_SLOT_KEY.FEATURED_4,
  FEATURED_5: HOMEPAGE_SLOT_KEY.FEATURED_5,
  CONVERSATION: "CONVERSATION",
  RECENCY_FALLBACK: "RECENCY_FALLBACK",
  HOMEPAGE_VIDEO: "HOMEPAGE_VIDEO",
  ARTICLE_GALLERY: "ARTICLE_GALLERY",
  ARTICLE_VIDEO: "ARTICLE_VIDEO",
  ARTICLE_BODY: "ARTICLE_BODY",
} as const;

export type AnalyticsPlacement =
  (typeof ANALYTICS_PLACEMENT)[keyof typeof ANALYTICS_PLACEMENT];

export const ANALYTICS_PLACEMENTS = Object.values(ANALYTICS_PLACEMENT);

export const ANALYTICS_HOMEPAGE_SLOT_PLACEMENTS = HOMEPAGE_SLOT_KEYS;

export type AnalyticsHomepageSlotPlacement = HomepageSlotKey;

export const ANALYTICS_TRAFFIC_KIND = {
  HUMAN: "HUMAN",
  BOT: "BOT",
  INTERNAL: "INTERNAL",
  TEST: "TEST",
  UNKNOWN: "UNKNOWN",
} as const;

export type AnalyticsTrafficKind =
  (typeof ANALYTICS_TRAFFIC_KIND)[keyof typeof ANALYTICS_TRAFFIC_KIND];

export const ANALYTICS_TRAFFIC_KINDS = Object.values(ANALYTICS_TRAFFIC_KIND);

export const ANALYTICS_TRAFFIC_SOURCE = {
  DIRECT: "DIRECT",
  SEARCH: "SEARCH",
  SOCIAL: "SOCIAL",
  INTERNAL: "INTERNAL",
  REFERRAL: "REFERRAL",
  UNKNOWN: "UNKNOWN",
} as const;

export type AnalyticsTrafficSource =
  (typeof ANALYTICS_TRAFFIC_SOURCE)[keyof typeof ANALYTICS_TRAFFIC_SOURCE];

export const ANALYTICS_TRAFFIC_SOURCES = Object.values(ANALYTICS_TRAFFIC_SOURCE);

export const ANALYTICS_GALLERY_NAVIGATION_METHOD = {
  PREV: "PREV",
  NEXT: "NEXT",
  THUMB: "THUMB",
  KEYBOARD: "KEYBOARD",
} as const;

export type AnalyticsGalleryNavigationMethod =
  (typeof ANALYTICS_GALLERY_NAVIGATION_METHOD)[keyof typeof ANALYTICS_GALLERY_NAVIGATION_METHOD];

export const ANALYTICS_GALLERY_NAVIGATION_METHODS = Object.values(
  ANALYTICS_GALLERY_NAVIGATION_METHOD,
);

export const ANALYTICS_APP_ENV = {
  DEVELOPMENT: "development",
  TEST: "test",
  STAGING: "staging",
  PRODUCTION: "production",
} as const;

export type AnalyticsAppEnv =
  (typeof ANALYTICS_APP_ENV)[keyof typeof ANALYTICS_APP_ENV];

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(value);
}

export function isRetiredAnalyticsEventName(value: string): boolean {
  return ANALYTICS_RETIRED_EVENT_NAMES.includes(value);
}

export function analyticsPlacementFromHomepageSlot(
  slotKey: HomepageSlotKey,
): AnalyticsPlacement {
  return slotKey;
}

const HOMEPAGE_SLOT_ORDINAL: Record<HomepageSlotKey, number> = {
  LEAD: 1,
  SUPPORT_1: 1,
  SUPPORT_2: 2,
  FEATURED_1: 1,
  FEATURED_2: 2,
  FEATURED_3: 3,
  FEATURED_4: 4,
  FEATURED_5: 5,
};

export function analyticsHomepageSlotOrdinal(slotKey: HomepageSlotKey): number {
  return HOMEPAGE_SLOT_ORDINAL[slotKey];
}

export function analyticsPlacementPositionBounds(placement: AnalyticsPlacement): {
  min: number;
  max: number;
} {
  if (placement === ANALYTICS_PLACEMENT.CONVERSATION) {
    return { min: 1, max: PUBLIC_HOMEPAGE_CONVERSATION_LIMIT };
  }
  if (placement === ANALYTICS_PLACEMENT.RECENCY_FALLBACK) {
    return { min: 0, max: 15 };
  }
  if (placement === ANALYTICS_PLACEMENT.ARTICLE_GALLERY) {
    return { min: 0, max: ARTICLE_GALLERY_MAX_ITEMS - 1 };
  }
  if (
    placement === ANALYTICS_PLACEMENT.LEAD ||
    placement === ANALYTICS_PLACEMENT.HOMEPAGE_VIDEO
  ) {
    return { min: 1, max: 1 };
  }
  if (
    placement === ANALYTICS_PLACEMENT.SUPPORT_1 ||
    placement === ANALYTICS_PLACEMENT.SUPPORT_2
  ) {
    return { min: 1, max: 2 };
  }
  if (
    placement === ANALYTICS_PLACEMENT.FEATURED_1 ||
    placement === ANALYTICS_PLACEMENT.FEATURED_2 ||
    placement === ANALYTICS_PLACEMENT.FEATURED_3 ||
    placement === ANALYTICS_PLACEMENT.FEATURED_4 ||
    placement === ANALYTICS_PLACEMENT.FEATURED_5
  ) {
    return { min: 1, max: 5 };
  }
  return { min: 0, max: ARTICLE_GALLERY_MAX_ITEMS };
}
