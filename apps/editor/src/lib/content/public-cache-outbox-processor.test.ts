import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PUBLIC_CACHE_OUTBOX_EVENT_TYPE,
  PUBLIC_CACHE_OUTBOX_STATUS,
  type PublicCacheOutboxEvent,
} from "@magazine/db/public-cache-outbox";
import { processPublicCacheOutboxBatch } from "./public-cache-outbox-processor";

function event(overrides: Partial<PublicCacheOutboxEvent> = {}): PublicCacheOutboxEvent {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    eventType: PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ARTICLE_CACHE_INVALIDATE,
    payload: {
      schemaVersion: 1,
      contentItemId: "22222222-2222-4222-8222-222222222222",
      slug: "kanonik-haber",
    },
    status: PUBLIC_CACHE_OUTBOX_STATUS.PROCESSING,
    attemptCount: 1,
    lockedAt: new Date("2026-08-18T10:00:00.000Z"),
    createdAt: new Date("2026-08-18T10:00:00.000Z"),
    ...overrides,
  };
}

describe("public cache outbox processor", () => {
  it("delivers a claimed event and marks it completed", async () => {
    const completed: string[] = [];
    const delivered: unknown[] = [];
    const summary = await processPublicCacheOutboxBatch(
      { limit: 5 },
      {
        claim: async () => [event()],
        deliverArticle: async (target) => {
          delivered.push(target);
        },
        markCompleted: async (claimed) => {
          completed.push(claimed.id);
          return true;
        },
      },
    );

    assert.deepEqual(summary, {
      claimed: 1,
      succeeded: 1,
      retryable: 0,
      dead: 0,
    });
    assert.deepEqual(delivered, [
      {
        contentItemId: "22222222-2222-4222-8222-222222222222",
        slug: "kanonik-haber",
      },
    ]);
    assert.deepEqual(completed, ["11111111-1111-4111-8111-111111111111"]);
  });

  it("delivers entity profile invalidation events", async () => {
    const delivered: unknown[] = [];
    await processPublicCacheOutboxBatch(
      { limit: 1 },
      {
        claim: async () => [
          event({
            eventType: PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_CACHE_INVALIDATE,
            payload: {
              schemaVersion: 1,
              entityId: "33333333-3333-4333-8333-333333333333",
              slug: "hande-ercel",
            },
          }),
        ],
        deliverEntity: async (target) => {
          delivered.push(target);
        },
        markCompleted: async () => true,
      },
    );

    assert.deepEqual(delivered, [
      {
        entityId: "33333333-3333-4333-8333-333333333333",
        slug: "hande-ercel",
        eventType: PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_CACHE_INVALIDATE,
      },
    ]);
  });

  it("marks delivery failures retryable or dead through the DB boundary", async () => {
    const statuses = [
      PUBLIC_CACHE_OUTBOX_STATUS.PENDING,
      PUBLIC_CACHE_OUTBOX_STATUS.DEAD,
    ];
    const summary = await processPublicCacheOutboxBatch(
      { limit: 5 },
      {
        claim: async () => [event({ id: "1" }), event({ id: "2" })],
        deliverArticle: async () => {
          throw new Error("cache unavailable");
        },
        markFailed: async () => statuses.shift() ?? PUBLIC_CACHE_OUTBOX_STATUS.DEAD,
      },
    );

    assert.deepEqual(summary, {
      claimed: 2,
      succeeded: 0,
      retryable: 1,
      dead: 1,
    });
  });
});
