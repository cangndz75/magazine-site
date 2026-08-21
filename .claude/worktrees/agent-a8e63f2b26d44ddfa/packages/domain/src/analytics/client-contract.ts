/**
 * Browser-safe analytics contract for public instrumentation.
 *
 * This module must stay free of Node builtins, ingestion parsers, and
 * staff/auth code. Event semantics remain those of taxonomy v1.
 */

import {
  HOMEPAGE_SLOT_KEYS,
  type HomepageSlotKey,
} from "../homepage-builder";
import { canonicalizeAnalyticsUtm, type AnalyticsUtmFields } from "./traffic";
import {
  ANALYTICS_CONSENT_POLICY,
  ANALYTICS_CONSENT_STATE,
  ANALYTICS_IMPRESSION_POLICY,
  ANALYTICS_SESSION_POLICY,
  ANALYTICS_TAXONOMY_VERSION,
  ANALYTICS_VISITOR_POLICY,
  VIDEO_PLAY_MEASUREMENT,
} from "./policy";
import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_GALLERY_NAVIGATION_METHOD,
  ANALYTICS_PLACEMENT,
  ANALYTICS_SURFACE,
  analyticsHomepageSlotOrdinal,
  type AnalyticsEventName,
  type AnalyticsGalleryNavigationMethod,
  type AnalyticsPlacement,
  type AnalyticsSurface,
} from "./taxonomy";

export const ANALYTICS_PUBLIC_INGEST_PATH = "/api/analytics/events";

export {
  ANALYTICS_CONSENT_POLICY,
  ANALYTICS_CONSENT_STATE,
  ANALYTICS_EVENT_NAME,
  ANALYTICS_GALLERY_NAVIGATION_METHOD,
  ANALYTICS_IMPRESSION_POLICY,
  ANALYTICS_PLACEMENT,
  ANALYTICS_SESSION_POLICY,
  ANALYTICS_SURFACE,
  ANALYTICS_TAXONOMY_VERSION,
  ANALYTICS_VISITOR_POLICY,
  VIDEO_PLAY_MEASUREMENT,
  analyticsHomepageSlotOrdinal,
};

export type {
  AnalyticsEventName,
  AnalyticsGalleryNavigationMethod,
  AnalyticsPlacement,
  AnalyticsSurface,
  AnalyticsUtmFields,
};

export type PublicHomepageAnalyticsPlacement = {
  contentItemId: string;
  publishedVersionId: string;
  placement: AnalyticsPlacement;
  position: number;
  analyticsContext?: string;
};

export type AnalyticsClientUtm = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
};

type AnalyticsClientEnvelope<
  Name extends AnalyticsEventName,
  Properties extends object,
> = {
  eventId: string;
  eventName: Name;
  schemaVersion: typeof ANALYTICS_TAXONOMY_VERSION;
  occurredAt: string;
  surface: AnalyticsSurface;
  analyticsContext?: string;
  properties: Properties;
};

export type ArticleViewClientEvent = AnalyticsClientEnvelope<
  "ARTICLE_VIEW",
  {
    contentItemId: string;
    publicSlug?: string;
    utm?: AnalyticsClientUtm;
  }
>;

export type HomepageViewClientEvent = AnalyticsClientEnvelope<
  "HOMEPAGE_VIEW",
  {
    homepageVersionId?: string | null;
    utm?: AnalyticsClientUtm;
  }
>;

export type WithdrawnPageViewClientEvent = AnalyticsClientEnvelope<
  "PAGE_VIEW",
  {
    contentItemId: string;
    publicSlug?: string;
    withdrawalKind?: "RETRACTION" | "TAKEDOWN";
    utm?: AnalyticsClientUtm;
  }
>;

export type HomepageContentImpressionClientEvent = AnalyticsClientEnvelope<
  "HOMEPAGE_CONTENT_IMPRESSION",
  {
    contentItemId: string;
    homepageVersionId?: string;
    placement: AnalyticsPlacement;
    position: number;
    pageViewContextId: string;
  }
>;

export type HomepageContentClickClientEvent = AnalyticsClientEnvelope<
  "HOMEPAGE_CONTENT_CLICK",
  {
    contentItemId: string;
    homepageVersionId?: string;
    placement: AnalyticsPlacement;
    position: number;
    pageViewContextId: string;
  }
>;

export type GalleryOpenClientEvent = AnalyticsClientEnvelope<
  "GALLERY_OPEN",
  {
    contentItemId: string;
    mediaId: string;
    galleryPosition: number;
  }
>;

export type GalleryImageViewClientEvent = AnalyticsClientEnvelope<
  "GALLERY_IMAGE_VIEW",
  {
    contentItemId: string;
    mediaId: string;
    galleryPosition: number;
  }
>;

export type GalleryNavigateClientEvent = AnalyticsClientEnvelope<
  "GALLERY_NAVIGATE",
  {
    contentItemId: string;
    mediaId: string;
    galleryPosition: number;
    navigationMethod: AnalyticsGalleryNavigationMethod;
  }
>;

export type VideoImpressionClientEvent = AnalyticsClientEnvelope<
  "VIDEO_IMPRESSION",
  {
    videoAssetId: string;
    placement: typeof ANALYTICS_PLACEMENT.ARTICLE_VIDEO | typeof ANALYTICS_PLACEMENT.HOMEPAGE_VIDEO;
    contentItemId?: string;
    homepageVersionId?: string;
  }
>;

export type AnalyticsClientEvent =
  | ArticleViewClientEvent
  | HomepageViewClientEvent
  | WithdrawnPageViewClientEvent
  | HomepageContentImpressionClientEvent
  | HomepageContentClickClientEvent
  | GalleryOpenClientEvent
  | GalleryImageViewClientEvent
  | GalleryNavigateClientEvent
  | VideoImpressionClientEvent;

export type GalleryAnalyticsAction = {
  method: AnalyticsGalleryNavigationMethod;
  fromIndex: number;
  toIndex: number;
};

export type GalleryAnalyticsEmission =
  | { eventName: "GALLERY_OPEN"; mediaId: string; galleryPosition: number }
  | { eventName: "GALLERY_NAVIGATE"; mediaId: string; galleryPosition: number; navigationMethod: AnalyticsGalleryNavigationMethod }
  | { eventName: "GALLERY_IMAGE_VIEW"; mediaId: string; galleryPosition: number };

/**
 * First gallery interaction emits OPEN, then NAVIGATE, then IMAGE_VIEW when
 * the active media actually changes. Returning A → B → A emits IMAGE_VIEW
 * for A again because that is a deliberate active-image transition.
 * Initial SSR of image 0 is not an open or a view.
 */
export function galleryAnalyticsEmissions(input: {
  opened: boolean;
  items: readonly { mediaId: string }[];
  action: GalleryAnalyticsAction;
}): {
  opened: boolean;
  index: number;
  emissions: readonly GalleryAnalyticsEmission[];
} {
  const total = input.items.length;
  if (total === 0) {
    return { opened: input.opened, index: 0, emissions: [] };
  }

  const fromIndex = clampGalleryIndex(input.action.fromIndex, total);
  const toIndex = clampGalleryIndex(input.action.toIndex, total);
  const from = input.items[fromIndex];
  const to = input.items[toIndex];
  if (!from || !to) {
    return { opened: input.opened, index: fromIndex, emissions: [] };
  }

  const emissions: GalleryAnalyticsEmission[] = [];
  let opened = input.opened;
  if (!opened) {
    emissions.push({
      eventName: ANALYTICS_EVENT_NAME.GALLERY_OPEN,
      mediaId: from.mediaId,
      galleryPosition: fromIndex,
    });
    opened = true;
  }

  emissions.push({
    eventName: ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE,
    mediaId: to.mediaId,
    galleryPosition: toIndex,
    navigationMethod: input.action.method,
  });

  if (from.mediaId !== to.mediaId || fromIndex !== toIndex) {
    emissions.push({
      eventName: ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW,
      mediaId: to.mediaId,
      galleryPosition: toIndex,
    });
  }

  return { opened, index: toIndex, emissions };
}

export function selectedAnalyticsUtmFromSearch(
  search: string,
): AnalyticsClientUtm | undefined {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const utm = canonicalizeAnalyticsUtm({
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
  });
  if (!utm.source && !utm.medium && !utm.campaign) {
    return undefined;
  }
  return utm;
}

export type HomepageAnalyticsDisplayedStory = {
  contentItemId: string;
  publishedVersionId: string;
};

export function buildPublishedHomepageContentPlacements(input: {
  homepageVersionId: string | null;
  editorialSlots: Readonly<Record<HomepageSlotKey, string | null>> | null;
  displayed: {
    lead: HomepageAnalyticsDisplayedStory | null;
    supports: readonly HomepageAnalyticsDisplayedStory[];
    featured: readonly HomepageAnalyticsDisplayedStory[];
  };
  conversation: readonly {
    rank: number;
    contentItemId: string | null;
    publishedVersionId: string | null;
  }[];
}): PublicHomepageAnalyticsPlacement[] {
  const placements: PublicHomepageAnalyticsPlacement[] = [];
  let fallbackPosition = 0;

  function pushBuilderOrFallback(
    story: HomepageAnalyticsDisplayedStory,
    slotKey: HomepageSlotKey,
  ): void {
    const editorialId = input.editorialSlots?.[slotKey] ?? null;
    if (
      input.homepageVersionId &&
      editorialId === story.contentItemId
    ) {
      placements.push({
        contentItemId: story.contentItemId,
        publishedVersionId: story.publishedVersionId,
        placement: slotKey,
        position: analyticsHomepageSlotOrdinal(slotKey),
      });
      return;
    }
    placements.push({
      contentItemId: story.contentItemId,
      publishedVersionId: story.publishedVersionId,
      placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
      position: fallbackPosition,
    });
    fallbackPosition += 1;
  }

  if (input.displayed.lead) {
    pushBuilderOrFallback(input.displayed.lead, HOMEPAGE_SLOT_KEYS[0]);
  }
  input.displayed.supports.forEach((story, index) => {
    const slotKey = index === 0 ? HOMEPAGE_SLOT_KEYS[1] : HOMEPAGE_SLOT_KEYS[2];
    pushBuilderOrFallback(story, slotKey);
  });
  input.displayed.featured.forEach((story, index) => {
    const slotKey = HOMEPAGE_SLOT_KEYS[3 + index];
    if (!slotKey) {
      return;
    }
    pushBuilderOrFallback(story, slotKey);
  });

  for (const item of input.conversation) {
    if (!item.contentItemId || !item.publishedVersionId) {
      continue;
    }
    placements.push({
      contentItemId: item.contentItemId,
      publishedVersionId: item.publishedVersionId,
      placement: ANALYTICS_PLACEMENT.CONVERSATION,
      position: item.rank,
    });
  }

  return placements;
}

export function impressionIdentity(input: {
  pageViewContextId: string;
  placement: AnalyticsPlacement;
  position: number;
  contentItemId: string;
}): string {
  return `${input.pageViewContextId}:${input.placement}:${input.position}:${input.contentItemId}`;
}

export function videoImpressionIdentity(input: {
  pageViewContextId: string;
  placement: AnalyticsPlacement;
  videoAssetId: string;
}): string {
  return `${input.pageViewContextId}:${input.placement}:${input.videoAssetId}`;
}

function clampGalleryIndex(index: number, total: number): number {
  if (total <= 0 || index < 0 || index >= total) {
    return 0;
  }
  return index;
}
