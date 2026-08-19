import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PublicArticleCacheInvalidatePayload } from "@magazine/domain";
import { handlePublicCacheInvalidationPost } from "./public-cache-invalidation-http";
import { invalidatePublicArticleCacheFromEvent } from "./public-cache-invalidation";

const SECRET = "12345678901234567890123456789012";
const CONTENT_ITEM_ID = "11111111-1111-4111-8111-111111111111";

function requestWith(authorization: string | null, body: unknown): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization !== null) {
    headers.set("authorization", authorization);
  }
  return new Request("http://localhost:3000/api/internal/public-cache/invalidate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const validEvent = {
  schemaVersion: 1 as const,
  contentItemId: CONTENT_ITEM_ID,
  slug: "kanonik-haber",
};

describe("public cache invalidation endpoint", () => {
  it("rejects missing and invalid bearer authentication", async () => {
    const missing = await handlePublicCacheInvalidationPost(
      requestWith(null, validEvent),
      SECRET,
    );
    const invalid = await handlePublicCacheInvalidationPost(
      requestWith("Bearer wrong-secret-value-000000000", validEvent),
      SECRET,
    );

    assert.equal(missing.status, 401);
    assert.deepEqual(await missing.json(), { ok: false, error: "UNAUTHORIZED" });
    assert.equal(invalid.status, 401);
    assert.deepEqual(await invalid.json(), { ok: false, error: "UNAUTHORIZED" });
  });

  it("rejects malformed payloads and arbitrary tag lists", async () => {
    const cases: unknown[] = [
      { schemaVersion: 1, contentItemId: "not-a-uuid", slug: "kanonik-haber" },
      {
        schemaVersion: 2,
        contentItemId: CONTENT_ITEM_ID,
        slug: "kanonik-haber",
      },
      { schemaVersion: 1, contentItemId: CONTENT_ITEM_ID },
      {
        schemaVersion: 1,
        contentItemId: CONTENT_ITEM_ID,
        slug: "kanonik-haber",
        tags: ["article-slug:kanonik-haber", "arbitrary"],
      },
    ];

    for (const body of cases) {
      const response = await handlePublicCacheInvalidationPost(
        requestWith(`Bearer ${SECRET}`, body),
        SECRET,
      );
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        ok: false, error: "INVALID_REQUEST",
      });
    }
  });

  it("accepts a valid bearer event and invalidates canonical tags", async () => {
    const tags: string[] = [];
    const response = await handlePublicCacheInvalidationPost(
      requestWith(`Bearer ${SECRET}`, validEvent),
      SECRET,
      async (event: PublicArticleCacheInvalidatePayload) => {
        const derived = await invalidatePublicArticleCacheFromEvent(
          event,
          (tag) => {
            tags.push(tag);
          },
        );
        return derived;
      },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
    assert.equal("tags" in body, false);
    assert.deepEqual(tags, [
      `content:${CONTENT_ITEM_ID}`,
      "article-slug:kanonik-haber",
    ]);
  });
});
