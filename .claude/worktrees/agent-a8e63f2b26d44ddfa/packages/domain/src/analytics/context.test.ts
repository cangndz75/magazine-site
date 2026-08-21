import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANALYTICS_ERROR } from "./validation";
import { ANALYTICS_EVENT_NAME, ANALYTICS_PLACEMENT, ANALYTICS_SURFACE } from "./taxonomy";
import { ANALYTICS_TAXONOMY_VERSION } from "./policy";
import {
  ANALYTICS_CONTEXT_FRAUD_BOUNDARY,
  ANALYTICS_CONTEXT_TTL_MS,
  ANALYTICS_TIMESTAMP_POLICY,
  bindAnalyticsWireContext,
  signAnalyticsContext,
  verifyAnalyticsContextToken,
} from "./index";
import type { AnalyticsWireEvent } from "./wire";

const KEY = "test-analytics-context-signing-key-32";
const OTHER_KEY = "other-analytics-context-signing-key32";
const CONTENT_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_A = "33333333-3333-4333-8333-333333333333";
const VERSION_B = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-08-21T12:00:00.000Z");

function articleWire(token: string, occurredAt = NOW): AnalyticsWireEvent {
  return {
    eventId: "11111111-1111-4111-8111-111111111111",
    eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    occurredAt,
    surface: ANALYTICS_SURFACE.ARTICLE,
    analyticsContext: token,
    properties: {
      eventName: "ARTICLE_VIEW",
      contentItemId: CONTENT_ID,
    },
  };
}

describe("signed analytics context", () => {
  it("matches the 7-day late-event window", () => {
    assert.equal(ANALYTICS_CONTEXT_TTL_MS, ANALYTICS_TIMESTAMP_POLICY.MAX_AGE_MS);
    assert.equal(ANALYTICS_CONTEXT_FRAUD_BOUNDARY.ADS_GRADE_ANTI_FRAUD, false);
  });

  it("rejects a modified signature, content identity, version, and placement", () => {
    const token = signAnalyticsContext({
      signingKey: KEY,
      now: NOW,
      surface: ANALYTICS_SURFACE.ARTICLE,
      contentItemId: CONTENT_ID,
      publishedVersionId: VERSION_A,
    });
    const verified = verifyAnalyticsContextToken({ token, signingKey: KEY });
    assert.equal(verified.ok, true);
    if (!verified.ok) return;
    assert.equal(verified.value.publishedVersionId, VERSION_A);

    const tamperedSig = `${token.slice(0, -2)}ab`;
    assert.equal(verifyAnalyticsContextToken({ token: tamperedSig, signingKey: KEY }).ok, false);

    const boundOtherItem = bindAnalyticsWireContext({
      wire: {
        ...articleWire(token),
        properties: { eventName: "ARTICLE_VIEW", contentItemId: VERSION_B },
      },
      signingKey: KEY,
    });
    assert.equal(boundOtherItem.ok, false);

    const versionBToken = signAnalyticsContext({
      signingKey: KEY,
      now: NOW,
      surface: ANALYTICS_SURFACE.ARTICLE,
      contentItemId: CONTENT_ID,
      publishedVersionId: VERSION_B,
    });
    const swapped = token.split(".");
    const forged = `${swapped[0]}.${versionBToken.split(".")[1]}.${swapped[2]}`;
    assert.equal(verifyAnalyticsContextToken({ token: forged, signingKey: KEY }).ok, false);

    const placementToken = signAnalyticsContext({
      signingKey: KEY,
      now: NOW,
      surface: ANALYTICS_SURFACE.HOMEPAGE,
      contentItemId: CONTENT_ID,
      publishedVersionId: VERSION_A,
      homepageVersionId: VERSION_B,
      placement: ANALYTICS_PLACEMENT.LEAD,
      position: 1,
    });
    const placementBound = bindAnalyticsWireContext({
      wire: {
        eventId: "11111111-1111-4111-8111-111111111111",
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: NOW,
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: placementToken,
        properties: {
          eventName: "HOMEPAGE_CONTENT_IMPRESSION",
          contentItemId: CONTENT_ID,
          placement: ANALYTICS_PLACEMENT.FEATURED_1,
          position: 1,
          pageViewContextId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      },
      signingKey: KEY,
    });
    assert.equal(placementBound.ok, false);
  });

  it("rejects expired and unsupported context versions", () => {
    const expired = signAnalyticsContext({
      signingKey: KEY,
      now: new Date(NOW.getTime() - ANALYTICS_CONTEXT_TTL_MS - 1000),
      surface: ANALYTICS_SURFACE.ARTICLE,
      contentItemId: CONTENT_ID,
      publishedVersionId: VERSION_A,
    });
    const late = bindAnalyticsWireContext({
      wire: articleWire(expired, NOW),
      signingKey: KEY,
    });
    assert.equal(late.ok, false);
    if (!late.ok) {
      assert.equal(late.code, ANALYTICS_ERROR.INVALID_CONTEXT);
    }

    const token = signAnalyticsContext({
      signingKey: KEY,
      now: NOW,
      surface: ANALYTICS_SURFACE.ARTICLE,
      contentItemId: CONTENT_ID,
      publishedVersionId: VERSION_A,
    });
    const parts = token.split(".");
    const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8")) as {
      v: number;
    };
    payload.v = 99;
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const unsupported = `${parts[0]}.${encoded}.${parts[2]}`;
    assert.equal(
      verifyAnalyticsContextToken({ token: unsupported, signingKey: KEY }).ok,
      false,
    );
    assert.equal(verifyAnalyticsContextToken({ token, signingKey: OTHER_KEY }).ok, false);
  });

  it("does not put editorial or media secrets in claims", () => {
    const token = signAnalyticsContext({
      signingKey: KEY,
      now: NOW,
      surface: ANALYTICS_SURFACE.ARTICLE,
      contentItemId: CONTENT_ID,
      publishedVersionId: VERSION_A,
    });
    const payload = Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8");
    assert.equal(payload.includes("title"), false);
    assert.equal(payload.includes("internalNote"), false);
    assert.equal(payload.includes("storageKey"), false);
    assert.equal(payload.includes("staffUserId"), false);
  });
});
