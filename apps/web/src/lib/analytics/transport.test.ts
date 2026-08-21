import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_PLACEMENT,
  ANALYTICS_SURFACE,
  ANALYTICS_TAXONOMY_VERSION,
} from "@magazine/domain/analytics-client";
import {
  createAnalyticsTracker,
  setAnalyticsTrackerForTests,
} from "./track";
import { deliverAnalyticsEvent } from "./transport";
import type { AnalyticsClientEvent } from "@magazine/domain/analytics-client";

const CONTENT_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const PAGE_VIEW_CONTEXT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

afterEach(() => {
  setAnalyticsTrackerForTests(null);
});

function articleViewEvent(eventId = EVENT_ID): AnalyticsClientEvent {
  return {
    eventId,
    eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
    schemaVersion: ANALYTICS_TAXONOMY_VERSION,
    occurredAt: "2026-08-21T08:00:00.000Z",
    surface: ANALYTICS_SURFACE.ARTICLE,
    properties: { contentItemId: CONTENT_ID },
  };
}

describe("public analytics transport", () => {
  it("generates unique event IDs and reuses the same ID on retry", async () => {
    const bodies: string[] = [];
    let failures = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input, init) => {
      bodies.push(String(init?.body));
      failures += 1;
      throw new Error("network");
    }) as typeof fetch;

    try {
      await deliverAnalyticsEvent(articleViewEvent());
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(bodies.length, 2);
    assert.equal(bodies[0], bodies[1]);
    assert.equal(JSON.parse(bodies[0]!).eventId, EVENT_ID);
    assert.equal(failures, 2);
  });

  it("swallows tracking failure without rejecting the caller", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network");
    }) as typeof fetch;
    try {
      await assert.doesNotReject(() => deliverAnalyticsEvent(articleViewEvent()));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not wait for the endpoint before a navigation callback", () => {
    let navigated = false;
    const hanging = createAnalyticsTracker({
      transport: () => new Promise(() => undefined),
      createEventId: () => EVENT_ID,
      now: () => new Date("2026-08-21T08:00:00.000Z"),
    });

    hanging.trackHomepageClick({
      contentItemId: CONTENT_ID,
      placement: ANALYTICS_PLACEMENT.LEAD,
      position: 1,
      pageViewContextId: PAGE_VIEW_CONTEXT_ID,
      analyticsContext: "v1.test-analytics-context-token",
    });
    navigated = true;
    assert.equal(navigated, true);
  });

  it("does not throw when the transport throws synchronously", () => {
    const tracker = createAnalyticsTracker({
      transport: () => {
        throw new Error("boom");
      },
    });
    assert.doesNotThrow(() =>
      tracker.trackArticleView({
        contentItemId: CONTENT_ID,
        publicSlug: "haber",
        analyticsContext: "v1.test-analytics-context-token",
      }),
    );
  });
});
