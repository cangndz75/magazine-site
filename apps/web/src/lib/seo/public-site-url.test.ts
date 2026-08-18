import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  publicArticleCanonicalUrl,
  publicSiteBaseUrl,
} from "./public-site-url";

describe("public site URL", () => {
  it("strips a trailing slash from the configured site URL", () => {
    assert.equal(publicSiteBaseUrl("https://www.example.com/"), "https://www.example.com");
    assert.equal(
      publicArticleCanonicalUrl("https://www.example.com/", "yayinlanan-haber"),
      "https://www.example.com/yayinlanan-haber",
    );
  });

  it("preserves a configured path prefix and local development origin", () => {
    assert.equal(
      publicArticleCanonicalUrl("https://www.example.com/tr", "yayinlanan-haber"),
      "https://www.example.com/tr/yayinlanan-haber",
    );
    assert.equal(
      publicArticleCanonicalUrl("http://localhost:3000", "yayinlanan-haber"),
      "http://localhost:3000/yayinlanan-haber",
    );
  });
});
