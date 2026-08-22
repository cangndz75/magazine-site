import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYTICS_APP_ENV,
  ANALYTICS_CONSENT_STATE,
  ANALYTICS_ERROR,
  ANALYTICS_EVENT_NAME,
  ANALYTICS_HTTP_ERROR,
  ANALYTICS_INGEST_STATUS,
  ANALYTICS_RATE_LIMIT_POLICY,
  ANALYTICS_SESSION_POLICY,
  ANALYTICS_SURFACE,
  ANALYTICS_TAXONOMY_VERSION,
  ANALYTICS_TRAFFIC_KIND,
  type AnalyticsEvent,
  type AnalyticsIngestionContext,
} from "@magazine/domain";
import { handleAnalyticsIngestPost } from "./ingest-http";
import type { IngestPublicAnalyticsEventResult } from "@magazine/db/analytics";

const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const CONTENT_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";

function articlePayload() {
  return {
    eventId: EVENT_ID,
    eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    occurredAt: "2026-08-21T08:00:00.000Z",
    surface: ANALYTICS_SURFACE.ARTICLE,
    properties: { contentItemId: CONTENT_ID },
  };
}

function acceptedEvent(trafficKind: typeof ANALYTICS_TRAFFIC_KIND.HUMAN | typeof ANALYTICS_TRAFFIC_KIND.BOT | typeof ANALYTICS_TRAFFIC_KIND.TEST): AnalyticsEvent {
  return {
    eventId: EVENT_ID,
    eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    occurredAt: new Date("2026-08-21T08:00:00.000Z"),
    receivedAt: new Date("2026-08-21T08:00:10.000Z"),
    anonymousVisitorId: null,
    anonymousSessionId: null,
    trafficKind,
    trafficSource: "DIRECT",
    referrerHost: null,
    surface: ANALYTICS_SURFACE.ARTICLE,
    properties: {
      contentItemId: CONTENT_ID,
      publishedVersionId: VERSION_ID,
      publicSlug: "yayinlanan-haber",
    },
  };
}

function requestWith(input: {
  origin?: string;
  referer?: string;
  contentType?: string;
  body?: unknown;
  rawBody?: string;
  userAgent?: string;
  search?: string;
}): Request {
  const headers = new Headers();
  headers.set("content-type", input.contentType ?? "application/json");
  if (input.origin) headers.set("origin", input.origin);
  if (input.referer) headers.set("referer", input.referer);
  if (input.userAgent) headers.set("user-agent", input.userAgent);
  const url = `https://www.example.com/api/analytics/events${input.search ?? ""}`;
  return new Request(url, {
    method: "POST",
    headers,
    body: input.rawBody ?? JSON.stringify(input.body ?? articlePayload()),
  });
}

describe("public analytics ingestion HTTP", () => {
  it("drops ingestion before parsing when the kill switch is active", async () => {
    let ingested = false;
    const response = await handleAnalyticsIngestPost(
      requestWith({ origin: "https://www.example.com", rawBody: "{not-json" }),
      {
        now: () => new Date("2026-08-21T08:00:10.000Z"),
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        trustedSiteOrigin: "https://www.example.com",
        consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
        analyticsContextSigningKey: "test-analytics-context-signing-key-32",
        rateLimitBuckets: new Map(),
        observe: () => undefined,
        isKillSwitchActive: async () => true,
        ingest: async () => {
          ingested = true;
          throw new Error("ingest should not be called");
        },
      },
    );

    assert.equal(response.status, 202);
    assert.equal(ingested, false);
    assert.deepEqual(await response.json(), {
      status: ANALYTICS_INGEST_STATUS.REJECTED,
      error: ANALYTICS_HTTP_ERROR.INGESTION_DISABLED,
    });
  });

  it("accepts a valid same-origin event with a minimal response", async () => {
    const response = await handleAnalyticsIngestPost(
      requestWith({ origin: "https://www.example.com" }),
      {
        now: () => new Date("2026-08-21T08:00:10.000Z"),
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        trustedSiteOrigin: "https://www.example.com",
        consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
        analyticsContextSigningKey: "test-analytics-context-signing-key-32",
        rateLimitBuckets: new Map(),
        observe: () => undefined,
        ingest: async () => ({
          ok: true,
          value: {
            event: acceptedEvent(ANALYTICS_TRAFFIC_KIND.HUMAN),
            outcome: "INSERTED",
          },
        }),
      },
    );
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { status: "accepted" });
    assert.equal(response.headers.get("set-cookie"), null);
  });

  it("does not set a persistent session cookie without GRANTED consent", async () => {
    const response = await handleAnalyticsIngestPost(
      requestWith({ origin: "https://www.example.com" }),
      {
        now: () => new Date("2026-08-21T08:00:10.000Z"),
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        trustedSiteOrigin: "https://www.example.com",
        consentState: ANALYTICS_CONSENT_STATE.DENIED,
        analyticsContextSigningKey: "test-analytics-context-signing-key-32",
        rateLimitBuckets: new Map(),
        observe: () => undefined,
        ingest: async (_input, context: AnalyticsIngestionContext) => {
          assert.equal(context.anonymousSessionId, null);
          return {
            ok: true,
            value: {
              event: acceptedEvent(ANALYTICS_TRAFFIC_KIND.HUMAN),
              outcome: "INSERTED",
            },
          };
        },
      },
    );
    assert.equal(response.status, 202);
    assert.equal(response.headers.get("set-cookie"), null);
  });

  it("sets an HttpOnly analytics session cookie only when consent is GRANTED", async () => {
    const response = await handleAnalyticsIngestPost(
      requestWith({ origin: "https://www.example.com" }),
      {
        now: () => new Date("2026-08-21T08:00:10.000Z"),
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        trustedSiteOrigin: "https://www.example.com",
        consentState: ANALYTICS_CONSENT_STATE.GRANTED,
        analyticsContextSigningKey: "test-analytics-context-signing-key-32",
        rateLimitBuckets: new Map(),
        observe: () => undefined,
        ingest: async () => ({
          ok: true,
          value: {
            event: acceptedEvent(ANALYTICS_TRAFFIC_KIND.HUMAN),
            outcome: "INSERTED",
          },
        }),
      },
    );
    const cookie = response.headers.get("set-cookie") ?? "";
    assert.match(cookie, new RegExp(`${ANALYTICS_SESSION_POLICY.COOKIE_NAME}=`));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Secure/i);
    assert.equal(cookie.includes("staff_session"), false);
  });

  it("rejects oversized bodies, cross-origin requests, and query-param TEST markers", async () => {
    const oversized = await handleAnalyticsIngestPost(
      requestWith({
        origin: "https://www.example.com",
        rawBody: JSON.stringify({ pad: "x".repeat(9000) }),
      }),
      {
        now: () => new Date("2026-08-21T08:00:10.000Z"),
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        trustedSiteOrigin: "https://www.example.com",
        consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
        analyticsContextSigningKey: "test-analytics-context-signing-key-32",
        rateLimitBuckets: new Map(),
        observe: () => undefined,
        ingest: async () => {
          throw new Error("should not ingest oversized body");
        },
      },
    );
    assert.equal(oversized.status, 413);

    const crossOrigin = await handleAnalyticsIngestPost(
      requestWith({ origin: "https://attacker.example" }),
      {
        now: () => new Date("2026-08-21T08:00:10.000Z"),
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        trustedSiteOrigin: "https://www.example.com",
        consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
        analyticsContextSigningKey: "test-analytics-context-signing-key-32",
        rateLimitBuckets: new Map(),
        observe: () => undefined,
        ingest: async () => {
          throw new Error("should not ingest cross-origin");
        },
      },
    );
    assert.equal(crossOrigin.status, 403);

    let seenKind: string | undefined;
    await handleAnalyticsIngestPost(
      requestWith({
        origin: "https://www.example.com",
        search: "?analytics_test=1",
        userAgent: "Mozilla/5.0",
      }),
      {
        now: () => new Date("2026-08-21T08:00:10.000Z"),
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        trustedSiteOrigin: "https://www.example.com",
        consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
        analyticsContextSigningKey: "test-analytics-context-signing-key-32",
        rateLimitBuckets: new Map(),
        observe: () => undefined,
        ingest: async (_input, context) => {
          assert.equal(context.trafficSignals.trustedTestEvidence, false);
          seenKind = context.appEnv;
          return {
            ok: true,
            value: {
              event: acceptedEvent(ANALYTICS_TRAFFIC_KIND.HUMAN),
              outcome: "INSERTED",
            },
          };
        },
      },
    );
    assert.equal(seenKind, ANALYTICS_APP_ENV.PRODUCTION);
  });

  it("returns 429 after the application rate-limit threshold", async () => {
    const buckets = new Map();
    const deps = {
      now: () => new Date("2026-08-21T08:00:10.000Z"),
      appEnv: ANALYTICS_APP_ENV.PRODUCTION,
      trustedSiteOrigin: "https://www.example.com",
      consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
      analyticsContextSigningKey: "test-analytics-context-signing-key-32",
      rateLimitBuckets: buckets,
      observe: () => undefined,
      ingest: async (): Promise<IngestPublicAnalyticsEventResult> => ({
        ok: true,
        value: {
          event: acceptedEvent(ANALYTICS_TRAFFIC_KIND.HUMAN),
          outcome: "INSERTED" as const,
        },
      }),
    };
    for (let i = 0; i < ANALYTICS_RATE_LIMIT_POLICY.MAX_REQUESTS_PER_WINDOW; i += 1) {
      const ok = await handleAnalyticsIngestPost(
        requestWith({ origin: "https://www.example.com" }),
        deps,
      );
      assert.equal(ok.status, 202);
    }
    const blocked = await handleAnalyticsIngestPost(
      requestWith({ origin: "https://www.example.com" }),
      deps,
    );
    assert.equal(blocked.status, 429);
    assert.deepEqual(await blocked.json(), {
      status: "rejected",
      error: ANALYTICS_HTTP_ERROR.RATE_LIMITED,
    });
  });

  it("classifies bots from user-agent and does not trust client HUMAN or CF headers", async () => {
    const response = await handleAnalyticsIngestPost(
      requestWith({
        origin: "https://www.example.com",
        userAgent: "Googlebot/2.1",
      }),
      {
        now: () => new Date("2026-08-21T08:00:10.000Z"),
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        trustedSiteOrigin: "https://www.example.com",
        consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
        analyticsContextSigningKey: "test-analytics-context-signing-key-32",
        rateLimitBuckets: new Map(),
        observe: () => undefined,
        ingest: async (_input, context) => {
          assert.equal(context.trafficSignals.cloudflareVerifiedBot, false);
          assert.equal(context.trafficSignals.userAgent, "Googlebot/2.1");
          return {
            ok: true,
            value: {
              event: acceptedEvent(ANALYTICS_TRAFFIC_KIND.BOT),
              outcome: "INSERTED",
            },
          };
        },
      },
    );
    assert.equal(response.status, 202);
  });

  it("returns a stable conflict payload without fingerprints", async () => {
    const response = await handleAnalyticsIngestPost(
      requestWith({ origin: "https://www.example.com" }),
      {
        now: () => new Date("2026-08-21T08:00:10.000Z"),
        appEnv: ANALYTICS_APP_ENV.PRODUCTION,
        trustedSiteOrigin: "https://www.example.com",
        consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
        analyticsContextSigningKey: "test-analytics-context-signing-key-32",
        rateLimitBuckets: new Map(),
        observe: () => undefined,
        ingest: async () => ({ ok: false, code: ANALYTICS_ERROR.EVENT_ID_CONFLICT }),
      },
    );
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.deepEqual(body, {
      status: "conflict",
      error: ANALYTICS_HTTP_ERROR.EVENT_ID_CONFLICT,
    });
    assert.equal(JSON.stringify(body).includes("fingerprint"), false);
  });
});
