import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_PLACEMENT,
  ANALYTICS_SURFACE,
  ANALYTICS_TAXONOMY_VERSION,
  type AnalyticsClientEvent,
} from "@magazine/domain/analytics-client";
import { createAnalyticsTracker } from "./track";

const CONTENT_ID = "22222222-2222-4222-8222-222222222222";
const MEDIA_ID = "77777777-7777-4777-8777-777777777777";
const VIDEO_ID = "88888888-8888-4888-8888-888888888888";
const PAGE_VIEW_CONTEXT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function recordingTracker() {
  const events: AnalyticsClientEvent[] = [];
  const tracker = createAnalyticsTracker({
    transport: (event) => {
      events.push(event);
    },
    createEventId: () => "11111111-1111-4111-8111-111111111111",
    now: () => new Date("2026-08-21T08:00:00.000Z"),
    search: () => "?utm_source=Newsletter&utm_campaign=launch_1&q=secret",
  });
  return { events, tracker };
}

const CONTEXT_TOKEN = "v1.test-analytics-context-token";

describe("public analytics tracker payloads", () => {
  it("emits a typed ARTICLE_VIEW without title, category, or author strings", () => {
    const { events, tracker } = recordingTracker();
    tracker.trackArticleView({
      contentItemId: CONTENT_ID,
      publicSlug: "yayinlanan-haber",
      analyticsContext: CONTEXT_TOKEN,
    });
    assert.equal(events.length, 1);
    const event = events[0]!;
    assert.equal(event.eventName, ANALYTICS_EVENT_NAME.ARTICLE_VIEW);
    assert.equal(event.schemaVersion, ANALYTICS_TAXONOMY_VERSION);
    assert.equal(event.surface, ANALYTICS_SURFACE.ARTICLE);
    if (event.eventName !== ANALYTICS_EVENT_NAME.ARTICLE_VIEW) return;
    assert.equal(event.properties.contentItemId, CONTENT_ID);
    assert.equal(event.properties.publicSlug, "yayinlanan-haber");
    assert.equal(event.analyticsContext, CONTEXT_TOKEN);
    assert.deepEqual(event.properties.utm, {
      source: "newsletter",
      campaign: "launch_1",
      medium: null,
    });
    const serialized = JSON.stringify(event);
    assert.equal(serialized.includes("title"), false);
    assert.equal(serialized.includes("author"), false);
    assert.equal(serialized.includes("category"), false);
    assert.equal(serialized.includes("trafficKind"), false);
    assert.equal(serialized.includes("q=secret"), false);
  });

  it("omits trafficKind and staff identity from homepage click payloads", () => {
    const { events, tracker } = recordingTracker();
    tracker.trackHomepageClick({
      contentItemId: CONTENT_ID,
      placement: ANALYTICS_PLACEMENT.LEAD,
      position: 1,
      pageViewContextId: PAGE_VIEW_CONTEXT_ID,
      homepageVersionId: "99999999-9999-4999-8999-999999999999",
      analyticsContext: CONTEXT_TOKEN,
    });
    const event = events[0]!;
    assert.equal(event.eventName, ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK);
    if (event.eventName !== ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK) return;
    assert.equal(event.properties.placement, ANALYTICS_PLACEMENT.LEAD);
    assert.equal(event.properties.position, 1);
    assert.equal("trafficKind" in event, false);
    assert.equal("title" in event.properties, false);
  });

  it("identifies gallery events with mediaId and position only", () => {
    const { events, tracker } = recordingTracker();
    tracker.trackGalleryImageView({
      contentItemId: CONTENT_ID,
      mediaId: MEDIA_ID,
      galleryPosition: 2,
      analyticsContext: CONTEXT_TOKEN,
    });
    const event = events[0]!;
    if (event.eventName !== ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW) return;
    assert.equal(event.properties.mediaId, MEDIA_ID);
    assert.equal(event.properties.galleryPosition, 2);
    assert.equal("storageKey" in event.properties, false);
  });

  it("identifies video impressions with videoAssetId and placement", () => {
    const { events, tracker } = recordingTracker();
    tracker.trackVideoImpression({
      videoAssetId: VIDEO_ID,
      placement: ANALYTICS_PLACEMENT.ARTICLE_VIDEO,
      contentItemId: CONTENT_ID,
      analyticsContext: CONTEXT_TOKEN,
    });
    const event = events[0]!;
    if (event.eventName !== ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION) return;
    assert.equal(event.properties.videoAssetId, VIDEO_ID);
    assert.equal(event.properties.placement, ANALYTICS_PLACEMENT.ARTICLE_VIDEO);
    assert.equal("provider" in event.properties, false);
  });

  it("does not expose a VIDEO_PLAY tracker", () => {
    const { tracker } = recordingTracker();
    assert.equal("trackVideoPlay" in tracker, false);
  });
});
