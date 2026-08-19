import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicArticleInvalidationTags } from "./public-cache-invalidation";

describe("public article cache invalidation tags", () => {
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
});
