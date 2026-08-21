import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYTICS_APP_ENV,
  ANALYTICS_CLOUDFLARE_TRUST,
  ANALYTICS_CONSENT_STATE,
  ANALYTICS_ERROR,
  ANALYTICS_EVENT_NAME,
  ANALYTICS_FIELD_OWNERSHIP,
  ANALYTICS_HTTP_BODY_MAX_BYTES,
  ANALYTICS_HTTP_ERROR,
  ANALYTICS_INGEST_STATUS,
  ANALYTICS_OPS_METRIC,
  ANALYTICS_PLACEMENT,
  ANALYTICS_RATE_LIMIT_POLICY,
  ANALYTICS_SURFACE,
  ANALYTICS_TAXONOMY_VERSION,
  ANALYTICS_TRAFFIC_KIND,
  VIDEO_PLAY_MEASUREMENT,
  analyticsEventFactFingerprint,
  analyticsEventLeaksSensitiveMaterial,
  consumeAnalyticsRateLimit,
  decideAcceptAnalyticsWireEvent,
  decideAnalyticsRequestOrigin,
  isDefaultAudienceTraffic,
  isJsonContentType,
  mapAnalyticsErrorToHttp,
  parseAnalyticsWireEvent,
  signAnalyticsContext,
} from "@magazine/domain";

const CONTENT_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const CATEGORY_ID = "44444444-4444-4444-8444-444444444444";
const AUTHOR_ID = "55555555-5555-4555-8555-555555555555";
const FAKE_CATEGORY = "66666666-6666-4666-8666-666666666666";
const MEDIA_ID = "77777777-7777-4777-8777-777777777777";
const VIDEO_ID = "88888888-8888-4888-8888-888888888888";
const HOMEPAGE_VERSION_ID = "99999999-9999-4999-8999-999999999999";
const PAGE_VIEW_CONTEXT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SIGNING_KEY = "test-analytics-context-signing-key-32";

function articleContext(overrides: {
  contentItemId?: string;
  publishedVersionId?: string;
  now?: Date;
} = {}) {
  return signAnalyticsContext({
    signingKey: SIGNING_KEY,
    now: overrides.now ?? new Date("2026-08-21T08:00:00.000Z"),
    surface: ANALYTICS_SURFACE.ARTICLE,
    contentItemId: overrides.contentItemId ?? CONTENT_ID,
    publishedVersionId: overrides.publishedVersionId ?? VERSION_ID,
  });
}

function homepageContext(overrides: {
  contentItemId?: string;
  publishedVersionId?: string;
  homepageVersionId?: string | null;
  placement?: typeof ANALYTICS_PLACEMENT.LEAD | typeof ANALYTICS_PLACEMENT.RECENCY_FALLBACK;
  position?: number;
} = {}) {
  return signAnalyticsContext({
    signingKey: SIGNING_KEY,
    now: new Date("2026-08-21T08:00:00.000Z"),
    surface: ANALYTICS_SURFACE.HOMEPAGE,
    contentItemId: overrides.contentItemId ?? CONTENT_ID,
    publishedVersionId: overrides.publishedVersionId ?? VERSION_ID,
    homepageVersionId:
      overrides.homepageVersionId === undefined ? HOMEPAGE_VERSION_ID : overrides.homepageVersionId,
    placement: overrides.placement ?? ANALYTICS_PLACEMENT.LEAD,
    position: overrides.position ?? 1,
  });
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    receivedAt: new Date("2026-08-21T08:00:10.000Z"),
    appEnv: ANALYTICS_APP_ENV.PRODUCTION,
    consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
    trustedSiteOrigin: "https://www.example.com",
    referrerUrl: null,
    trafficSignals: {},
    analyticsContextSigningKey: SIGNING_KEY,
    ...overrides,
  };
}

function articleViewWire(overrides: Record<string, unknown> = {}) {
  return {
    eventId: EVENT_ID,
    eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    occurredAt: "2026-08-21T08:00:00.000Z",
    surface: ANALYTICS_SURFACE.ARTICLE,
    analyticsContext: articleContext(),
    properties: {
      contentItemId: CONTENT_ID,
      publicSlug: "yayinlanan-haber",
    },
    ...overrides,
  };
}

describe("analytics public ingestion contracts", () => {
  it("maps domain errors to stable HTTP codes without stacks", () => {
    assert.deepEqual(mapAnalyticsErrorToHttp(ANALYTICS_ERROR.EVENT_TOO_LARGE), {
      status: 413,
      error: ANALYTICS_HTTP_ERROR.EVENT_TOO_LARGE,
    });
    assert.deepEqual(mapAnalyticsErrorToHttp(ANALYTICS_ERROR.EVENT_ID_CONFLICT), {
      status: 409,
      error: ANALYTICS_HTTP_ERROR.EVENT_ID_CONFLICT,
    });
    assert.deepEqual(mapAnalyticsErrorToHttp(ANALYTICS_ERROR.RATE_LIMITED), {
      status: 429,
      error: ANALYTICS_HTTP_ERROR.RATE_LIMITED,
    });
    assert.equal(ANALYTICS_INGEST_STATUS.ACCEPTED, "accepted");
    assert.equal(ANALYTICS_OPS_METRIC.ACCEPTED, "analytics.accepted");
    assert.equal(ANALYTICS_HTTP_BODY_MAX_BYTES, 8192);
    assert.equal(ANALYTICS_CLOUDFLARE_TRUST.TRUST_BOT_HEADERS, false);
    assert.equal(VIDEO_PLAY_MEASUREMENT.STATUS, "DEFERRED");
  });

  it("ignores client category, author, trafficKind, and provider overrides", () => {
    const parsed = parseAnalyticsWireEvent({
      ...articleViewWire(),
      properties: {
        contentItemId: CONTENT_ID,
        primaryCategoryId: FAKE_CATEGORY,
        authorIds: [AUTHOR_ID],
        trafficKind: ANALYTICS_TRAFFIC_KIND.HUMAN,
        publishedVersionId: VERSION_ID,
      },
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal("primaryCategoryId" in parsed.value.properties, false);
    assert.equal("authorIds" in parsed.value.properties, false);
    assert.equal(ANALYTICS_FIELD_OWNERSHIP.HINT_MATCH_POLICY, "FAIL_CLOSED");

    const accepted = decideAcceptAnalyticsWireEvent(
      {
        ...articleViewWire(),
        properties: {
          contentItemId: CONTENT_ID,
          primaryCategoryId: FAKE_CATEGORY,
          authorIds: ["99999999-9999-4999-8999-999999999991"],
        },
      },
      context({
        trafficSignals: { userAgent: "Googlebot/2.1" },
      }),
      {
        type: "ARTICLE_LIVE",
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        publicSlug: "yayinlanan-haber",
        primaryCategoryId: CATEGORY_ID,
        authorIds: [AUTHOR_ID],
      },
    );
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.value.eventName, ANALYTICS_EVENT_NAME.ARTICLE_VIEW);
    if (accepted.value.eventName !== ANALYTICS_EVENT_NAME.ARTICLE_VIEW) return;
    assert.equal(accepted.value.properties.primaryCategoryId, CATEGORY_ID);
    assert.deepEqual(accepted.value.properties.authorIds, [AUTHOR_ID]);
    assert.equal(accepted.value.trafficKind, ANALYTICS_TRAFFIC_KIND.BOT);
    assert.equal(isDefaultAudienceTraffic(accepted.value), false);
    assert.equal(accepted.value.receivedAt.toISOString(), "2026-08-21T08:00:10.000Z");
  });

  it("rejects ARTICLE_VIEW against withdrawn or unpublished snapshots", () => {
    const withdrawn = decideAcceptAnalyticsWireEvent(articleViewWire(), context(), {
      type: "WITHDRAWN_SHELL",
      contentItemId: CONTENT_ID,
      publicSlug: "yayinlanan-haber",
      withdrawalKind: "RETRACTION",
    });
    assert.equal(withdrawn.ok, false);
    if (!withdrawn.ok) {
      assert.equal(withdrawn.code, ANALYTICS_ERROR.NOT_PUBLIC);
    }

    const staleVersion = decideAcceptAnalyticsWireEvent(
      {
        ...articleViewWire(),
        properties: {
          contentItemId: CONTENT_ID,
          publishedVersionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        },
      },
      context(),
      {
        type: "ARTICLE_LIVE",
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        publicSlug: "yayinlanan-haber",
      },
    );
    assert.equal(staleVersion.ok, false);
    if (!staleVersion.ok) {
      assert.equal(staleVersion.code, ANALYTICS_ERROR.INVALID_CONTEXT);
    }
  });

  it("accepts withdrawn-shell PAGE_VIEW with server withdrawal kind", () => {
    const accepted = decideAcceptAnalyticsWireEvent(
      {
        eventId: EVENT_ID,
        eventName: ANALYTICS_EVENT_NAME.PAGE_VIEW,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.WITHDRAWN_SHELL,
        properties: {
          contentItemId: CONTENT_ID,
          withdrawalKind: "TAKEDOWN",
          internalNote: "staff-only",
        },
      },
      context(),
      {
        type: "WITHDRAWN_SHELL",
        contentItemId: CONTENT_ID,
        publicSlug: "yayinlanan-haber",
        withdrawalKind: "RETRACTION",
      },
    );
    assert.equal(accepted.ok, false);

    const clean = decideAcceptAnalyticsWireEvent(
      {
        eventId: EVENT_ID,
        eventName: ANALYTICS_EVENT_NAME.PAGE_VIEW,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.WITHDRAWN_SHELL,
        properties: {
          contentItemId: CONTENT_ID,
          withdrawalKind: "TAKEDOWN",
        },
      },
      context(),
      {
        type: "WITHDRAWN_SHELL",
        contentItemId: CONTENT_ID,
        publicSlug: "yayinlanan-haber",
        withdrawalKind: "RETRACTION",
      },
    );
    assert.equal(clean.ok, true);
    if (!clean.ok) return;
    if (clean.value.eventName !== ANALYTICS_EVENT_NAME.PAGE_VIEW) return;
    assert.equal(clean.value.properties.withdrawalKind, "RETRACTION");
    assert.equal(analyticsEventLeaksSensitiveMaterial(clean.value.properties), false);
  });

  it("rejects fake homepage slot and gallery media combinations", () => {
    const fakeSlot = decideAcceptAnalyticsWireEvent(
      {
        eventId: EVENT_ID,
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: homepageContext(),
        properties: {
          contentItemId: CONTENT_ID,
          homepageVersionId: HOMEPAGE_VERSION_ID,
          placement: ANALYTICS_PLACEMENT.LEAD,
          position: 1,
          pageViewContextId: PAGE_VIEW_CONTEXT_ID,
        },
      },
      context(),
      {
        type: "HOMEPAGE_SLOT",
        homepageVersionId: HOMEPAGE_VERSION_ID,
        contentItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.LEAD,
        position: 1,
      },
    );
    assert.equal(fakeSlot.ok, false);

    const fakeMedia = decideAcceptAnalyticsWireEvent(
      {
        eventId: EVENT_ID,
        eventName: ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: articleContext(),
        properties: {
          contentItemId: CONTENT_ID,
          mediaId: MEDIA_ID,
          galleryPosition: 0,
        },
      },
      context(),
      {
        type: "GALLERY",
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        mediaId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        galleryPosition: 0,
      },
    );
    assert.equal(fakeMedia.ok, false);

    const fakeFallback = decideAcceptAnalyticsWireEvent(
      {
        eventId: EVENT_ID,
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: homepageContext({
          homepageVersionId: null,
          placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
          position: 0,
        }),
        properties: {
          contentItemId: CONTENT_ID,
          placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
          position: 0,
          pageViewContextId: PAGE_VIEW_CONTEXT_ID,
        },
      },
      context(),
      {
        type: "HOMEPAGE_FALLBACK",
        homepageVersionId: null,
        contentItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
        position: 0,
      },
    );
    assert.equal(fakeFallback.ok, false);
    if (!fakeFallback.ok) {
      assert.equal(fakeFallback.code, ANALYTICS_ERROR.INVALID_CONTEXT);
    }

    const wrongSnapshotType = decideAcceptAnalyticsWireEvent(
      {
        eventId: EVENT_ID,
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: homepageContext({
          homepageVersionId: null,
          placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
          position: 0,
        }),
        properties: {
          contentItemId: CONTENT_ID,
          placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
          position: 0,
          pageViewContextId: PAGE_VIEW_CONTEXT_ID,
        },
      },
      context(),
      {
        type: "HOMEPAGE_SLOT",
        homepageVersionId: HOMEPAGE_VERSION_ID,
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.LEAD,
        position: 1,
      },
    );
    assert.equal(wrongSnapshotType.ok, false);
    if (!wrongSnapshotType.ok) {
      assert.equal(wrongSnapshotType.code, ANALYTICS_ERROR.INVALID_CONTEXT);
    }
  });

  it("accepts a signed recency fallback impression without a homepage version", () => {
    const accepted = decideAcceptAnalyticsWireEvent(
      {
        eventId: EVENT_ID,
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: homepageContext({
          homepageVersionId: null,
          placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
          position: 0,
        }),
        properties: {
          contentItemId: CONTENT_ID,
          placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
          position: 0,
          pageViewContextId: PAGE_VIEW_CONTEXT_ID,
        },
      },
      context(),
      {
        type: "HOMEPAGE_FALLBACK",
        homepageVersionId: null,
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
        position: 0,
      },
    );
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    if (accepted.value.eventName !== ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION) {
      return;
    }
    assert.equal(accepted.value.properties.placement, ANALYTICS_PLACEMENT.RECENCY_FALLBACK);
    assert.equal(accepted.value.properties.homepageVersionId, null);
    assert.equal("analyticsContext" in accepted.value, false);
  });

  it("derives video provider from the server snapshot", () => {
    const accepted = decideAcceptAnalyticsWireEvent(
      {
        eventId: EVENT_ID,
        eventName: ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: articleContext(),
        properties: {
          videoAssetId: VIDEO_ID,
          provider: "VIMEO",
          contentItemId: CONTENT_ID,
          placement: ANALYTICS_PLACEMENT.ARTICLE_VIDEO,
          submittedUrl: "https://example.com/secret",
        },
      },
      context(),
      {
        type: "VIDEO_ARTICLE",
        videoAssetId: VIDEO_ID,
        provider: "YOUTUBE",
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
      },
    );
    assert.equal(accepted.ok, false);

    const clean = decideAcceptAnalyticsWireEvent(
      {
        eventId: EVENT_ID,
        eventName: ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: articleContext(),
        properties: {
          videoAssetId: VIDEO_ID,
          provider: "VIMEO",
          contentItemId: CONTENT_ID,
          placement: ANALYTICS_PLACEMENT.ARTICLE_VIDEO,
        },
      },
      context(),
      {
        type: "VIDEO_ARTICLE",
        videoAssetId: VIDEO_ID,
        provider: "YOUTUBE",
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
      },
    );
    assert.equal(clean.ok, true);
    if (!clean.ok) return;
    if (clean.value.eventName !== ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION) return;
    assert.equal(clean.value.properties.provider, "YOUTUBE");
    assert.equal("submittedUrl" in clean.value.properties, false);
  });

  it("keeps fingerprints stable across receivedAt and transport metadata", () => {
    const first = decideAcceptAnalyticsWireEvent(articleViewWire(), context(), {
      type: "ARTICLE_LIVE",
      contentItemId: CONTENT_ID,
      publishedVersionId: VERSION_ID,
      publicSlug: "yayinlanan-haber",
    });
    const second = decideAcceptAnalyticsWireEvent(
      articleViewWire(),
      context({ receivedAt: new Date("2026-08-21T08:00:40.000Z") }),
      {
        type: "ARTICLE_LIVE",
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        publicSlug: "yayinlanan-haber",
      },
    );
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(
      analyticsEventFactFingerprint(first.value),
      analyticsEventFactFingerprint(second.value),
    );

    const other = decideAcceptAnalyticsWireEvent(
      { ...articleViewWire(), eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
      context(),
      {
        type: "ARTICLE_LIVE",
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        publicSlug: "yayinlanan-haber",
      },
    );
    assert.equal(other.ok, true);
    if (!other.ok) return;
    assert.notEqual(
      analyticsEventFactFingerprint(first.value),
      analyticsEventFactFingerprint(other.value),
    );
  });

  it("does not persist a session identifier unless consent is GRANTED", () => {
    const unknown = decideAcceptAnalyticsWireEvent(
      articleViewWire(),
      context({
        consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
        anonymousSessionId: EVENT_ID,
      }),
      {
        type: "ARTICLE_LIVE",
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        publicSlug: "yayinlanan-haber",
      },
    );
    assert.equal(unknown.ok, true);
    if (!unknown.ok) return;
    assert.equal(unknown.value.anonymousSessionId, null);
    assert.equal(unknown.value.anonymousVisitorId, null);

    const granted = decideAcceptAnalyticsWireEvent(
      articleViewWire(),
      context({
        consentState: ANALYTICS_CONSENT_STATE.GRANTED,
        anonymousSessionId: EVENT_ID,
      }),
      {
        type: "ARTICLE_LIVE",
        contentItemId: CONTENT_ID,
        publishedVersionId: VERSION_ID,
        publicSlug: "yayinlanan-haber",
      },
    );
    assert.equal(granted.ok, true);
    if (!granted.ok) return;
    assert.equal(granted.value.anonymousSessionId, EVENT_ID);
  });

  it("rejects cross-origin browser requests and allows missing Origin", () => {
    const rejected = decideAnalyticsRequestOrigin({
      originHeader: "https://attacker.example",
      refererHeader: null,
      secFetchSite: "cross-site",
      trustedSiteOrigin: "https://www.example.com",
    });
    assert.equal(rejected.ok, false);

    const sameOrigin = decideAnalyticsRequestOrigin({
      originHeader: "https://www.example.com",
      refererHeader: null,
      secFetchSite: "same-origin",
      trustedSiteOrigin: "https://www.example.com",
    });
    assert.equal(sameOrigin.ok, true);

    const serverToServer = decideAnalyticsRequestOrigin({
      originHeader: null,
      refererHeader: null,
      secFetchSite: null,
      trustedSiteOrigin: "https://www.example.com",
    });
    assert.equal(serverToServer.ok, true);
    assert.equal(isJsonContentType("application/json; charset=utf-8"), true);
    assert.equal(isJsonContentType("text/plain"), false);
  });

  it("rate-limits after the configured window threshold", () => {
    let bucket = consumeAnalyticsRateLimit({ nowMs: 1_000, bucket: undefined }).bucket;
    for (let i = 1; i < ANALYTICS_RATE_LIMIT_POLICY.MAX_REQUESTS_PER_WINDOW; i += 1) {
      const next = consumeAnalyticsRateLimit({ nowMs: 1_000, bucket });
      assert.equal(next.allowed, true);
      bucket = next.bucket;
    }
    const blocked = consumeAnalyticsRateLimit({ nowMs: 1_000, bucket });
    assert.equal(blocked.allowed, false);
  });

  it("rejects unknown events, oversized payloads, and financial properties", () => {
    const unknown = parseAnalyticsWireEvent({
      ...articleViewWire(),
      eventName: "PAGE_HEARTBEAT",
    });
    assert.equal(unknown.ok, false);

    const financial = parseAnalyticsWireEvent({
      ...articleViewWire(),
      properties: { contentItemId: CONTENT_ID, revenue: 12.5 },
    });
    assert.equal(financial.ok, false);

    const huge = parseAnalyticsWireEvent({
      ...articleViewWire(),
      properties: { contentItemId: CONTENT_ID, publicSlug: "a".repeat(9000) },
    });
    assert.equal(huge.ok, false);
    if (!huge.ok) {
      assert.equal(huge.code, ANALYTICS_ERROR.EVENT_TOO_LARGE);
    }
  });
});
