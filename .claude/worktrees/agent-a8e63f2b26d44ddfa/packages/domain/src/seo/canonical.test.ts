import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SEO_CANONICAL_ERROR,
  SEO_CANONICAL_OVERRIDE_REJECTION,
  decidePublicArticleCanonicalUrl,
  publicArticleCanonicalUrl,
  publicHomepageCanonicalUrl,
  publicSiteBaseUrl,
  publicSitemapIndexUrl,
  publicSitemapShardUrl,
  resolvePublicArticleCanonical,
  storedCanonicalHasQuery,
  storedCanonicalLooksLikeEditorUrl,
  storedCanonicalUsesUntrustedOrigin,
} from "./canonical";

describe("public canonical contract", () => {
  it("builds canonical URLs from the trusted configured origin and slug only", () => {
    assert.equal(
      publicArticleCanonicalUrl("https://www.example.com/", "yayinlanan-haber"),
      "https://www.example.com/yayinlanan-haber",
    );
    assert.equal(
      publicArticleCanonicalUrl("https://www.example.com/tr", "yayinlanan-haber"),
      "https://www.example.com/tr/yayinlanan-haber",
    );
    assert.equal(
      publicHomepageCanonicalUrl("https://www.example.com/"),
      "https://www.example.com",
    );
    assert.equal(
      publicSitemapIndexUrl("https://www.example.com"),
      "https://www.example.com/sitemap.xml",
    );
    assert.equal(
      publicSitemapShardUrl("https://www.example.com", 0),
      "https://www.example.com/sitemap/0.xml",
    );
  });

  it("cannot be Host-header poisoned because the builder has no request-host input", () => {
    const trusted = "https://www.example.com";
    const attackerHost = "evil.example";
    const canonical = publicArticleCanonicalUrl(trusted, "kanonik-haber");
    assert.equal(canonical, "https://www.example.com/kanonik-haber");
    assert.equal(canonical.includes(attackerHost), false);
    assert.equal("requestHost" in { trustedSiteUrl: trusted, slug: "kanonik-haber" }, false);
  });

  it("encodes the slug as a single path segment and never copies query parameters", () => {
    const canonical = publicArticleCanonicalUrl(
      "https://www.example.com",
      "kanonik-haber",
    );
    const url = new URL(canonical);
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
    assert.equal(url.pathname, "/kanonik-haber");
    assert.equal(storedCanonicalHasQuery("https://www.example.com/haber?utm=1"), true);
    assert.equal(storedCanonicalHasQuery(canonical), false);
  });

  it("rejects invalid slugs and untrusted origins instead of emitting editor URLs", () => {
    assert.equal(
      decidePublicArticleCanonicalUrl({
        trustedSiteUrl: "https://www.example.com",
        slug: "../login",
      }).ok,
      false,
    );
    const denied = decidePublicArticleCanonicalUrl({
      trustedSiteUrl: "javascript:alert(1)",
      slug: "haber",
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.code, SEO_CANONICAL_ERROR.INVALID_TRUSTED_ORIGIN);
    }
    assert.equal(
      storedCanonicalLooksLikeEditorUrl({
        storedCanonicalUrl: "https://editor.example.com/content/abc",
        editorOrigin: "https://editor.example.com",
      }),
      true,
    );
    assert.equal(
      storedCanonicalUsesUntrustedOrigin({
        storedCanonicalUrl: "https://evil.example/haber",
        trustedSiteUrl: "https://www.example.com",
      }),
      true,
    );
  });

  it("strips credentials and uses origin from SITE_URL, not a userinfo host", () => {
    const denied = decidePublicArticleCanonicalUrl({
      trustedSiteUrl: "https://user:pass@www.example.com",
      slug: "haber",
    });
    assert.equal(denied.ok, false);
    assert.equal(publicSiteBaseUrl("https://www.example.com/magazine/"), "https://www.example.com/magazine");
  });

  it("accepts a same-origin override and rejects cross-origin, credentials, and unsafe schemes", () => {
    const trusted = "https://www.example.com";
    const applied = resolvePublicArticleCanonical({
      trustedSiteUrl: trusted,
      slug: "kanonik-haber",
      storedCanonicalUrl: "https://www.example.com/ozel-kanonik",
    });
    assert.equal(applied.appliedOverride, true);
    assert.equal(applied.url, "https://www.example.com/ozel-kanonik");
    assert.equal(applied.rejection, null);

    const blank = resolvePublicArticleCanonical({
      trustedSiteUrl: trusted,
      slug: "kanonik-haber",
      storedCanonicalUrl: "  ",
    });
    assert.equal(blank.url, "https://www.example.com/kanonik-haber");
    assert.equal(blank.appliedOverride, false);

    const cross = resolvePublicArticleCanonical({
      trustedSiteUrl: trusted,
      slug: "kanonik-haber",
      storedCanonicalUrl: "https://evil.example/haber",
    });
    assert.equal(cross.appliedOverride, false);
    assert.equal(cross.rejection, SEO_CANONICAL_OVERRIDE_REJECTION.CROSS_ORIGIN);
    assert.equal(cross.url, "https://www.example.com/kanonik-haber");

    const javascript = resolvePublicArticleCanonical({
      trustedSiteUrl: trusted,
      slug: "kanonik-haber",
      storedCanonicalUrl: "javascript:alert(1)",
    });
    assert.equal(javascript.rejection, SEO_CANONICAL_OVERRIDE_REJECTION.UNSAFE_SCHEME);
    assert.equal(javascript.url, "https://www.example.com/kanonik-haber");

    const credentials = resolvePublicArticleCanonical({
      trustedSiteUrl: trusted,
      slug: "kanonik-haber",
      storedCanonicalUrl: "https://user:pass@www.example.com/haber",
    });
    assert.equal(credentials.rejection, SEO_CANONICAL_OVERRIDE_REJECTION.CREDENTIALS);

    const query = resolvePublicArticleCanonical({
      trustedSiteUrl: trusted,
      slug: "kanonik-haber",
      storedCanonicalUrl: "https://www.example.com/haber?utm=1",
    });
    assert.equal(query.rejection, SEO_CANONICAL_OVERRIDE_REJECTION.QUERY_OR_HASH);

    const hostHeader = resolvePublicArticleCanonical({
      trustedSiteUrl: trusted,
      slug: "kanonik-haber",
      storedCanonicalUrl: "https://www.example.com/kanonik-haber",
    });
    assert.equal(hostHeader.url?.includes("evil.example"), false);
  });
});
