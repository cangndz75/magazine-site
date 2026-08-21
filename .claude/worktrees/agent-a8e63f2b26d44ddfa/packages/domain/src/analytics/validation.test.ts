import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLICATION_STATUS } from "../publication-status";
import {
  ANALYTICS_APP_ENV,
  ANALYTICS_CONSENT_STATE,
  ANALYTICS_CONTENT_IDENTITY_POLICY,
  ANALYTICS_ERROR,
  ANALYTICS_EVENT_MAX_BYTES,
  ANALYTICS_EVENT_NAME,
  ANALYTICS_GALLERY_NAVIGATION_METHOD,
  ANALYTICS_IMPRESSION_POLICY,
  ANALYTICS_PLACEMENT,
  ANALYTICS_SURFACE,
  ANALYTICS_TAXONOMY_VERSION,
  ANALYTICS_TRAFFIC_KIND,
  ANALYTICS_TRAFFIC_SOURCE,
  VIDEO_PLAY_MEASUREMENT,
  articleViewIsAuthoritative,
  classifyPublicContentAnalytics,
  decideAcceptAnalyticsEvent,
  generateAnalyticsEventId,
  parseClientAnalyticsEvent,
  toAnalyticsRawEventRecord,
  withdrawnShellIsArticleView,
} from "./index";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const CONTENT_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const CATEGORY_ID = "44444444-4444-4444-8444-444444444444";
const AUTHOR_ID = "55555555-5555-4555-8555-555555555555";
const MEDIA_ID = "66666666-6666-4666-8666-666666666666";
const VIDEO_ID = "77777777-7777-4777-8777-777777777777";
const HOMEPAGE_VERSION_ID = "88888888-8888-4888-8888-888888888888";
const PAGE_VIEW_CONTEXT_ID = "99999999-9999-4999-8999-999999999999";
const SESSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OCCURRED = "2026-08-21T08:00:00.000Z";

function articleView(overrides: Record<string, unknown> = {}) {
  return {
    eventId: EVENT_ID,
    eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    occurredAt: OCCURRED,
    surface: ANALYTICS_SURFACE.ARTICLE,
    properties: {
      contentItemId: CONTENT_ID,
      publishedVersionId: VERSION_ID,
      publicSlug: "yayinlanan-haber",
      primaryCategoryId: CATEGORY_ID,
      authorIds: [AUTHOR_ID],
    },
    ...overrides,
  };
}

function acceptContext() {
  return {
    receivedAt: new Date("2026-08-21T08:00:10.000Z"),
    appEnv: ANALYTICS_APP_ENV.PRODUCTION,
    consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
    trustedSiteOrigin: "https://www.example.com",
    trafficSignals: {},
  };
}

describe("analytics event validation", () => {
  it("accepts a strongly typed ARTICLE_VIEW and captures published version plus contextual slug", () => {
    const parsed = parseClientAnalyticsEvent(articleView());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.eventName, ANALYTICS_EVENT_NAME.ARTICLE_VIEW);
    if (parsed.value.eventName !== ANALYTICS_EVENT_NAME.ARTICLE_VIEW) return;
    assert.equal(parsed.value.properties.contentItemId, CONTENT_ID);
    assert.equal(parsed.value.properties.publishedVersionId, VERSION_ID);
    assert.equal(parsed.value.properties.publicSlug, "yayinlanan-haber");
    assert.equal(ANALYTICS_CONTENT_IDENTITY_POLICY.PRIMARY_KEY, "contentItemId");
    assert.equal(ANALYTICS_CONTENT_IDENTITY_POLICY.SLUG_IS_CONTEXTUAL, true);
  });

  it("rejects unknown events, retired reuse, and unsupported schema versions", () => {
    const unknown = parseClientAnalyticsEvent({
      ...articleView(),
      eventName: "ENGAGED_READER",
    });
    assert.equal(unknown.ok, false);
    if (!unknown.ok) {
      assert.equal(unknown.code, ANALYTICS_ERROR.UNKNOWN_EVENT);
    }

    const version = parseClientAnalyticsEvent({
      ...articleView(),
      schemaVersion: 2,
    });
    assert.equal(version.ok, false);
    if (!version.ok) {
      assert.equal(version.code, ANALYTICS_ERROR.UNSUPPORTED_SCHEMA_VERSION);
    }
  });

  it("rejects invalid UUIDs, prototype pollution, and unbounded nested metadata", () => {
    const invalidId = parseClientAnalyticsEvent({
      ...articleView(),
      eventId: "not-a-uuid",
    });
    assert.equal(invalidId.ok, false);

    const pollutedProperties = JSON.parse(
      `{"contentItemId":"${CONTENT_ID}","publishedVersionId":"${VERSION_ID}","publicSlug":"yayinlanan-haber","__proto__":{"admin":true}}`,
    );
    const pollutionParsed = parseClientAnalyticsEvent({
      ...articleView(),
      properties: pollutedProperties,
    });
    assert.equal(pollutionParsed.ok, false);

    const nested = parseClientAnalyticsEvent({
      ...articleView(),
      properties: {
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        publicSlug: "yayinlanan-haber",
        extra: { nested: { title: "untrusted" } },
      },
    });
    assert.equal(nested.ok, false);
  });

  it("keeps accepted events under the serialized size bound", () => {
    const parsed = parseClientAnalyticsEvent(articleView());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const bytes = Buffer.byteLength(JSON.stringify(parsed.value), "utf8");
    assert.equal(bytes < ANALYTICS_EVENT_MAX_BYTES, true);
    assert.equal(ANALYTICS_EVENT_MAX_BYTES, 8192);
  });

  it("does not treat withdrawn shells as ARTICLE_VIEW", () => {
    const live = {
      publicationStatus: PUBLICATION_STATUS.PUBLISHED,
      publishedVersionId: VERSION_ID,
      retractedAt: null,
      takedownAt: null,
      deletedAt: null,
    };
    assert.equal(articleViewIsAuthoritative(live), true);
    const retracted = classifyPublicContentAnalytics({
      ...live,
      retractedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    assert.equal(retracted.kind, ANALYTICS_EVENT_NAME.PAGE_VIEW);
    if (retracted.kind === ANALYTICS_EVENT_NAME.PAGE_VIEW) {
      assert.equal(retracted.surface, ANALYTICS_SURFACE.WITHDRAWN_SHELL);
      assert.equal(retracted.withdrawalKind, "RETRACTION");
    }
    assert.equal(withdrawnShellIsArticleView(), false);

    const shell = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.PAGE_VIEW,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.WITHDRAWN_SHELL,
      properties: {
        contentItemId: CONTENT_ID,
        publicSlug: "cekilen-haber",
        withdrawalKind: "TAKEDOWN",
        internalNote: "counsel",
      },
    });
    assert.equal(shell.ok, false);

    const safeShell = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.PAGE_VIEW,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.WITHDRAWN_SHELL,
      properties: {
        contentItemId: CONTENT_ID,
        publicSlug: "cekilen-haber",
        withdrawalKind: "TAKEDOWN",
      },
    });
    assert.equal(safeShell.ok, true);

    const unpublished = classifyPublicContentAnalytics({
      publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
      publishedVersionId: VERSION_ID,
    });
    assert.equal(unpublished.kind, "NOT_PUBLIC");
  });

  it("keeps correction/clarification on ordinary ARTICLE_VIEW because the body stays public", () => {
    const parsed = parseClientAnalyticsEvent({
      ...articleView(),
      properties: {
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        publicSlug: "yayinlanan-haber",
        publicLegalNoticeKind: "CORRECTION",
      },
    });
    assert.equal(parsed.ok, true);
    const retractedAsArticle = parseClientAnalyticsEvent({
      ...articleView(),
      properties: {
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        publicSlug: "yayinlanan-haber",
        publicLegalNoticeKind: "RETRACTION",
      },
    });
    assert.equal(retractedAsArticle.ok, false);
  });

  it("requires homepage placement, ordinal, and homepage version on impression/click", () => {
    const impression = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.HOMEPAGE,
      properties: {
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        homepageVersionId: HOMEPAGE_VERSION_ID,
        placement: ANALYTICS_PLACEMENT.FEATURED_3,
        position: 3,
        pageViewContextId: PAGE_VIEW_CONTEXT_ID,
        title: "untrusted card text",
      },
    });
    assert.equal(impression.ok, false);

    const valid = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.HOMEPAGE,
      properties: {
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        homepageVersionId: HOMEPAGE_VERSION_ID,
        placement: ANALYTICS_PLACEMENT.FEATURED_3,
        position: 3,
        pageViewContextId: PAGE_VIEW_CONTEXT_ID,
      },
    });
    assert.equal(valid.ok, true);
    if (valid.ok && valid.value.eventName === ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK) {
      assert.equal(valid.value.properties.placement, "FEATURED_3");
      assert.equal(valid.value.properties.position, 3);
      assert.equal(valid.value.properties.homepageVersionId, HOMEPAGE_VERSION_ID);
    }

    const mismatchedOrdinal = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.HOMEPAGE,
      properties: {
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.LEAD,
        position: 4,
        pageViewContextId: PAGE_VIEW_CONTEXT_ID,
      },
    });
    assert.equal(mismatchedOrdinal.ok, false);
    assert.equal(ANALYTICS_IMPRESSION_POLICY.SERVER_HTML_IS_NOT_PROOF_OF_VIEW, true);
    assert.equal(ANALYTICS_IMPRESSION_POLICY.MIN_VISIBLE_RATIO, 0.5);
  });

  it("binds gallery events to media ID, article/version identity, and bounded position", () => {
    const view = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.ARTICLE,
      properties: {
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        mediaId: MEDIA_ID,
        galleryPosition: 2,
        storageKey: "secret/key.jpg",
      },
    });
    assert.equal(view.ok, false);

    const navigate = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.ARTICLE,
      properties: {
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        mediaId: MEDIA_ID,
        galleryPosition: 2,
        navigationMethod: ANALYTICS_GALLERY_NAVIGATION_METHOD.NEXT,
      },
    });
    assert.equal(navigate.ok, true);

    const outOfRange = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.GALLERY_OPEN,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.ARTICLE,
      properties: {
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        mediaId: MEDIA_ID,
        galleryPosition: 99,
      },
    });
    assert.equal(outOfRange.ok, false);
  });

  it("identifies editorial video by asset/provider/surface and rejects submittedUrl/rightsNote", () => {
    const play = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.VIDEO_PLAY,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.ARTICLE,
      properties: {
        videoAssetId: VIDEO_ID,
        provider: "YOUTUBE",
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.ARTICLE_VIDEO,
        submittedUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ",
      },
    });
    assert.equal(play.ok, false);

    const impression = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.HOMEPAGE,
      properties: {
        videoAssetId: VIDEO_ID,
        provider: "VIMEO",
        homepageVersionId: HOMEPAGE_VERSION_ID,
        placement: ANALYTICS_PLACEMENT.HOMEPAGE_VIDEO,
      },
    });
    assert.equal(impression.ok, true);

    const trustedPlay = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.VIDEO_PLAY,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.ARTICLE,
      properties: {
        videoAssetId: VIDEO_ID,
        provider: "YOUTUBE",
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.ARTICLE_VIDEO,
      },
    });
    assert.equal(trustedPlay.ok, true);
    assert.equal(VIDEO_PLAY_MEASUREMENT.STATUS, "DEFERRED");
    assert.equal(VIDEO_PLAY_MEASUREMENT.COMPLETION_AND_WATCH_TIME_DEFINED, false);
  });

  it("accepts engagement clicks with host/path only, never full query URLs", () => {
    const outbound = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.ARTICLE_OUTBOUND_CLICK,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.ARTICLE,
      properties: {
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        destinationHost: "example.org",
      },
    });
    assert.equal(outbound.ok, true);

    const fullUrl = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.ARTICLE_OUTBOUND_CLICK,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.ARTICLE,
      properties: {
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        destinationHost: "https://example.org/path?q=secret",
      },
    });
    assert.equal(fullUrl.ok, false);

    const internal = parseClientAnalyticsEvent({
      eventId: EVENT_ID,
      eventName: ANALYTICS_EVENT_NAME.ARTICLE_INTERNAL_CLICK,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: OCCURRED,
      surface: ANALYTICS_SURFACE.ARTICLE,
      properties: {
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        destinationPath: "/diger-haber",
      },
    });
    assert.equal(internal.ok, true);
  });

  it("overwrites client traffic fields, strips session without consent, and rejects clock skew", () => {
    const accepted = decideAcceptAnalyticsEvent(
      {
        ...articleView(),
        anonymousSessionId: SESSION_ID,
      },
      {
        ...acceptContext(),
        consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
        referrerUrl: "https://www.google.com/search?q=secret",
      },
    );
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.value.anonymousSessionId, null);
    assert.equal(accepted.value.anonymousVisitorId, null);
    assert.equal(accepted.value.trafficSource, ANALYTICS_TRAFFIC_SOURCE.SEARCH);
    assert.equal(accepted.value.referrerHost, "google.com");
    assert.equal(accepted.value.trafficKind, ANALYTICS_TRAFFIC_KIND.HUMAN);

    const granted = decideAcceptAnalyticsEvent(
      { ...articleView(), anonymousSessionId: SESSION_ID },
      { ...acceptContext(), consentState: ANALYTICS_CONSENT_STATE.GRANTED },
    );
    assert.equal(granted.ok, true);
    if (granted.ok) {
      assert.equal(granted.value.anonymousSessionId, SESSION_ID);
    }

    const future = decideAcceptAnalyticsEvent(articleView({ occurredAt: "2026-08-22T00:00:00.000Z" }), {
      ...acceptContext(),
      receivedAt: new Date("2026-08-21T08:00:10.000Z"),
    });
    assert.equal(future.ok, false);
    if (!future.ok) {
      assert.equal(future.code, ANALYTICS_ERROR.TIMESTAMP_OUT_OF_WINDOW);
    }

    const ancient = decideAcceptAnalyticsEvent(articleView({ occurredAt: "2026-01-01T00:00:00.000Z" }), {
      ...acceptContext(),
      receivedAt: new Date("2026-08-21T08:00:10.000Z"),
    });
    assert.equal(ancient.ok, false);

    const record = granted.ok
      ? toAnalyticsRawEventRecord(granted.value, "test-fingerprint")
      : null;
    assert.equal(record?.contentItemId, CONTENT_ID);
    assert.equal(record?.publishedVersionId, VERSION_ID);
    assert.equal(record?.publicSlug, "yayinlanan-haber");
    assert.equal(isUuidLike(generateAnalyticsEventId()), true);
  });
});

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
