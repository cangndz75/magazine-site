import { ANALYTICS_TRAFFIC_KIND, type AnalyticsTrafficKind } from "./taxonomy";

export const ANALYTICS_METRIC = {
  ARTICLE_VIEWS: "ARTICLE_VIEWS",
  HOMEPAGE_IMPRESSIONS: "HOMEPAGE_IMPRESSIONS",
  HOMEPAGE_CLICKS: "HOMEPAGE_CLICKS",
  HOMEPAGE_CTR: "HOMEPAGE_CTR",
  VIDEO_PLAYS: "VIDEO_PLAYS",
  GALLERY_IMAGE_VIEWS: "GALLERY_IMAGE_VIEWS",
  SESSIONS: "SESSIONS",
  UNIQUE_VISITORS: "UNIQUE_VISITORS",
} as const;

export type AnalyticsMetricName =
  (typeof ANALYTICS_METRIC)[keyof typeof ANALYTICS_METRIC];

export const ANALYTICS_DEFAULT_AUDIENCE_TRAFFIC_KIND = ANALYTICS_TRAFFIC_KIND.HUMAN;

export const ANALYTICS_METRIC_DEFINITIONS = {
  ARTICLE_VIEWS:
    "Count of accepted HUMAN ARTICLE_VIEW events after eventId dedupe. Slug is contextual, not the identity key.",
  HOMEPAGE_IMPRESSIONS:
    "Count of accepted HUMAN HOMEPAGE_CONTENT_IMPRESSION events after eventId dedupe.",
  HOMEPAGE_CLICKS:
    "Count of accepted HUMAN HOMEPAGE_CONTENT_CLICK events after eventId dedupe.",
  HOMEPAGE_CTR:
    "HOMEPAGE_CLICKS / HOMEPAGE_IMPRESSIONS. When impressions are 0, CTR is null, never 0 or Infinity.",
  VIDEO_PLAYS:
    "Count of accepted HUMAN VIDEO_PLAY events after eventId dedupe. Emission is deferred until a trusted player API exists.",
  GALLERY_IMAGE_VIEWS:
    "Count of accepted HUMAN GALLERY_IMAGE_VIEW events after eventId dedupe.",
  SESSIONS:
    "Distinct anonymous analytics session identifiers among accepted HUMAN events that have a session id. Not unique people.",
  UNIQUE_VISITORS:
    "Reserved. v1 does not emit durable visitor IDs and must not be labeled unique users or unique people.",
} as const;

export function isDefaultAudienceTrafficKind(kind: AnalyticsTrafficKind): boolean {
  return kind === ANALYTICS_TRAFFIC_KIND.HUMAN;
}

export function isDefaultAudienceTraffic(event: {
  trafficKind: AnalyticsTrafficKind;
}): boolean {
  return isDefaultAudienceTrafficKind(event.trafficKind);
}

export function countAudienceEvents(input: {
  trafficKind: AnalyticsTrafficKind;
  eventIds: readonly string[];
}): number {
  if (!isDefaultAudienceTrafficKind(input.trafficKind)) {
    return 0;
  }
  return new Set(input.eventIds).size;
}

/**
 * Zero impressions must not become 0% CTR. Dashboards should render an
 * explicit empty state.
 */
export function homepageCtr(
  clicks: number,
  impressions: number,
): number | null {
  if (impressions <= 0) {
    return null;
  }
  if (clicks < 0) {
    return null;
  }
  return clicks / impressions;
}

export function uniqueAnonymousSessions(
  sessionIds: readonly (string | null | undefined)[],
): number {
  const unique = new Set<string>();
  for (const id of sessionIds) {
    if (typeof id === "string" && id.length > 0) {
      unique.add(id);
    }
  }
  return unique.size;
}
