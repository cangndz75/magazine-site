import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  invalidatePublicArticleCache,
  publicArticleInvalidationTags,
} from "./public-cache-invalidation";

describe("public article cache invalidation", () => {
  it("builds content and article-slug tags deterministically", () => {
    assert.deepEqual(
      publicArticleInvalidationTags({
        contentItemId: "11111111-1111-4111-8111-111111111111",
        slug: "kanonik-haber",
      }),
      [
        "content:11111111-1111-4111-8111-111111111111",
        "article-slug:kanonik-haber",
      ],
    );
  });

  it("logs and does not throw when Next cache invalidation fails", async () => {
    const calls: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      calls.push(args);
    };

    try {
      await invalidatePublicArticleCache(
        {
          contentItemId: "11111111-1111-4111-8111-111111111111",
          slug: "kanonik-haber",
        },
        () => {
          throw new Error("cache unavailable");
        },
      );
    } finally {
      console.error = originalError;
    }

    assert.equal(calls.length, 1);
    assert.equal(
      JSON.stringify(calls[0]).includes("11111111-1111-4111-8111-111111111111"),
      true,
    );
    assert.equal(JSON.stringify(calls[0]).includes("article-slug:kanonik-haber"), true);
  });
});
