import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { getEditorEnv } from "@magazine/config/env/editor";
import {
  joinPublicWebInternalUrl,
  PUBLIC_CACHE_INVALIDATION_TIMEOUT_MS,
  deliverPublicArticleCacheInvalidation,
} from "./public-cache-delivery";
import { processPublicCacheOutboxBatch } from "./public-cache-outbox-processor";
import {
  PUBLIC_CACHE_OUTBOX_EVENT_TYPE,
  PUBLIC_CACHE_OUTBOX_STATUS,
  type PublicCacheOutboxEvent,
} from "@magazine/db/public-cache-outbox";

const SECRET = "12345678901234567890123456789012";
const BASE_URL = "http://localhost:3000";
const TARGET = {
  contentItemId: "22222222-2222-4222-8222-222222222222",
  slug: "kanonik-haber",
};

function event(overrides: Partial<PublicCacheOutboxEvent> = {}): PublicCacheOutboxEvent {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    eventType: PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ARTICLE_CACHE_INVALIDATE,
    payload: {
      schemaVersion: 1,
      contentItemId: TARGET.contentItemId,
      slug: TARGET.slug,
    },
    status: PUBLIC_CACHE_OUTBOX_STATUS.PROCESSING,
    attemptCount: 1,
    lockedAt: new Date("2026-08-18T10:00:00.000Z"),
    createdAt: new Date("2026-08-18T10:00:00.000Z"),
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown = { ok: true }): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("public web cache delivery", () => {
  it("posts the versioned event without caller-supplied tags", async () => {
    let posted: { url: string; authorization: string | null; body: unknown } | null =
      null;
    await deliverPublicArticleCacheInvalidation(TARGET, {
      baseUrl: BASE_URL,
      secret: SECRET,
      fetchImpl: async (url, init) => {
        const headers = new Headers(init?.headers);
        posted = {
          url: String(url),
          authorization: headers.get("authorization"),
          body: JSON.parse(String(init?.body)),
        };
        return jsonResponse(200);
      },
    });

    assert.deepEqual(posted, {
      url: "http://localhost:3000/api/internal/public-cache/invalidate",
      authorization: `Bearer ${SECRET}`,
      body: {
        schemaVersion: 1,
        contentItemId: TARGET.contentItemId,
        slug: TARGET.slug,
      },
    });
  });

  it("joins the internal invalidation path without credentials", () => {
    assert.equal(
      joinPublicWebInternalUrl("http://localhost:3000"),
      "http://localhost:3000/api/internal/public-cache/invalidate",
    );
    assert.equal(
      joinPublicWebInternalUrl("http://localhost:3000/"),
      "http://localhost:3000/api/internal/public-cache/invalidate",
    );
    assert.throws(
      () => joinPublicWebInternalUrl("http://user:pass@localhost:3000"),
      /must not include credentials/,
    );
  });

  it("marks successful 2xx delivery completed, including duplicate delivery", async () => {
    const completed: string[] = [];
    let fetches = 0;
    const deliver = async () => {
      fetches += 1;
      await deliverPublicArticleCacheInvalidation(TARGET, {
        baseUrl: BASE_URL,
        secret: SECRET,
        fetchImpl: async () => jsonResponse(200),
      });
    };

    const first = await processPublicCacheOutboxBatch(
      { limit: 5 },
      {
        claim: async () => [event()],
        deliver,
        markCompleted: async (claimed) => {
          completed.push(claimed.id);
          return true;
        },
      },
    );
    const second = await processPublicCacheOutboxBatch(
      { limit: 5 },
      {
        claim: async () => [event()],
        deliver,
        markCompleted: async (claimed) => {
          completed.push(claimed.id);
          return true;
        },
      },
    );

    assert.deepEqual(first, { claimed: 1, succeeded: 1, retryable: 0, dead: 0 });
    assert.deepEqual(second, { claimed: 1, succeeded: 1, retryable: 0, dead: 0 });
    assert.equal(fetches, 2);
    assert.deepEqual(completed, [
      "11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("keeps transport, timeout, 500, and 401 failures out of COMPLETED", async () => {
    const failures = [
      async () => {
        await deliverPublicArticleCacheInvalidation(TARGET, {
          baseUrl: BASE_URL,
          secret: SECRET,
          fetchImpl: async () => {
            throw new TypeError("fetch failed");
          },
        });
      },
      async () => {
        await deliverPublicArticleCacheInvalidation(TARGET, {
          baseUrl: BASE_URL,
          secret: SECRET,
          timeoutMs: 1,
          fetchImpl: async (_url, init) => {
            const signal = init?.signal;
            return new Promise<Response>((_resolve, reject) => {
              if (signal?.aborted) {
                reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
                return;
              }
              signal?.addEventListener("abort", () => {
                reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
              });
            });
          },
        });
      },
      async () => {
        await deliverPublicArticleCacheInvalidation(TARGET, {
          baseUrl: BASE_URL,
          secret: SECRET,
          fetchImpl: async () => jsonResponse(500, { ok: false }),
        });
      },
      async () => {
        await deliverPublicArticleCacheInvalidation(TARGET, {
          baseUrl: BASE_URL,
          secret: SECRET,
          fetchImpl: async () => jsonResponse(401, { ok: false, error: "UNAUTHORIZED" }),
        });
      },
    ];

    for (const deliver of failures) {
      const statuses: string[] = [];
      const summary = await processPublicCacheOutboxBatch(
        { limit: 5 },
        {
          claim: async () => [event()],
          deliver,
          markCompleted: async () => {
            throw new Error("must not complete");
          },
          markFailed: async () => {
            statuses.push(PUBLIC_CACHE_OUTBOX_STATUS.PENDING);
            return PUBLIC_CACHE_OUTBOX_STATUS.PENDING;
          },
        },
      );
      assert.deepEqual(summary, {
        claimed: 1,
        succeeded: 0,
        retryable: 1,
        dead: 0,
      });
      assert.deepEqual(statuses, [PUBLIC_CACHE_OUTBOX_STATUS.PENDING]);
    }
  });

  it("maps timeout to a bounded retryable message", async () => {
    await assert.rejects(
      () =>
        deliverPublicArticleCacheInvalidation(TARGET, {
          baseUrl: BASE_URL,
          secret: SECRET,
          timeoutMs: 1,
          fetchImpl: async (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
              });
            }),
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "Public web cache invalidation timed out." &&
        !error.message.includes(SECRET),
    );
    assert.equal(PUBLIC_CACHE_INVALIDATION_TIMEOUT_MS > 0, true);
  });

  it("does not treat a lost 2xx as completed until a later successful retry", async () => {
    const outcomes: string[] = [];
    const lost = await processPublicCacheOutboxBatch(
      { limit: 5 },
      {
        claim: async () => [event()],
        deliver: async () => {
          throw new Error("Public web cache invalidation timed out.");
        },
        markFailed: async () => PUBLIC_CACHE_OUTBOX_STATUS.PENDING,
      },
    );
    const retry = await processPublicCacheOutboxBatch(
      { limit: 5 },
      {
        claim: async () => [event({ attemptCount: 2 })],
        deliver: async () => {
          await deliverPublicArticleCacheInvalidation(TARGET, {
            baseUrl: BASE_URL,
            secret: SECRET,
            fetchImpl: async () => jsonResponse(200),
          });
        },
        markCompleted: async () => {
          outcomes.push("completed");
          return true;
        },
      },
    );

    assert.deepEqual(lost, { claimed: 1, succeeded: 0, retryable: 1, dead: 0 });
    assert.deepEqual(retry, { claimed: 1, succeeded: 1, retryable: 0, dead: 0 });
    assert.deepEqual(outcomes, ["completed"]);
  });
});

describe("editor public cache env contract", () => {
  const base = {
    NODE_ENV: "test",
    APP_ENV: "development",
    SITE_URL: "http://localhost:3000",
    EDITOR_URL: "http://localhost:3001",
    SCHEDULED_PUBLISH_RUNNER_SECRET: SECRET,
    PUBLIC_CACHE_INVALIDATION_SECRET: SECRET,
    PUBLIC_WEB_INTERNAL_BASE_URL: "http://localhost:3000",
  };

  it("keeps the internal web base URL and cache secret server-only", () => {
    const env = getEditorEnv(base);
    assert.equal(env.PUBLIC_WEB_INTERNAL_BASE_URL, "http://localhost:3000");
    assert.equal(env.PUBLIC_CACHE_INVALIDATION_SECRET, SECRET);
    assert.equal("NEXT_PUBLIC_PUBLIC_CACHE_INVALIDATION_SECRET" in env, false);
    assert.equal("NEXT_PUBLIC_PUBLIC_WEB_INTERNAL_BASE_URL" in env, false);
  });

  it("fails clearly when hosted production values are missing", () => {
    assert.throws(
      () =>
        getEditorEnv({
          ...base,
          APP_ENV: "production",
          PUBLIC_CACHE_INVALIDATION_SECRET: undefined,
          PUBLIC_WEB_INTERNAL_BASE_URL: undefined,
        }),
      /Invalid editor environment variables/,
    );
  });

  it("does not keep public cache delivery on editor revalidateTag", () => {
    const delivery = readFileSync(
      fileURLToPath(new URL("./public-cache-delivery.ts", import.meta.url)),
      "utf8",
    );
    const processor = readFileSync(
      fileURLToPath(new URL("./public-cache-outbox-processor.ts", import.meta.url)),
      "utf8",
    );
    const envSource = readFileSync(
      fileURLToPath(
        new URL("../../../../../packages/config/src/env/editor.ts", import.meta.url),
      ),
      "utf8",
    );
    const processRoute = readFileSync(
      fileURLToPath(
        new URL(
          "../../app/api/internal/public-cache-outbox/process/route.ts",
          import.meta.url,
        ),
      ),
      "utf8",
    );

    assert.equal(delivery.includes("revalidateTag"), false);
    assert.equal(processor.includes("revalidateTag"), false);
    assert.equal(
      processRoute.includes("assertScheduledPublishRunnerAuthorized"),
      true,
    );
    assert.equal(processRoute.includes("withEditorWrite"), false);
    assert.equal(delivery.includes("NEXT_PUBLIC_"), false);
    assert.equal(processor.includes("NEXT_PUBLIC_"), false);
    assert.equal(
      envSource.includes("NEXT_PUBLIC_PUBLIC_CACHE_INVALIDATION_SECRET"),
      false,
    );
    assert.equal(
      envSource.includes("NEXT_PUBLIC_PUBLIC_WEB_INTERNAL_BASE_URL"),
      false,
    );
  });
});
