import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYTICS_SURFACE,
  verifyAnalyticsContextToken,
} from "@magazine/domain";
import type { PublicArticle, PublicArticlePage } from "@magazine/db/public";
import { attachPublicArticleAnalyticsContext } from "./attach-public-article-context";

const SIGNING_KEY = "test-analytics-context-signing-key-32";

function livePage(): PublicArticlePage {
  const article: PublicArticle = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    publishedVersionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    slug: "haber",
    title: "Cached title",
    subtitle: null,
    excerpt: null,
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    robots: null,
    publishedAt: new Date("2026-08-18T00:00:00.000Z"),
    publicDateModified: null,
    body: { blocks: [] },
    hero: null,
    gallery: [],
    videos: [],
    categories: [],
    authors: [],
    entities: [],
    legalNotices: [],
  };
  return { status: "live", article };
}

describe("attachPublicArticleAnalyticsContext", () => {
  it("signs a fresh article context even when the cached payload omitted it", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    const page = attachPublicArticleAnalyticsContext(livePage(), {
      signingKey: SIGNING_KEY,
      now,
    });
    assert.equal(page?.status, "live");
    if (page?.status !== "live") {
      return;
    }
    assert.equal(typeof page.article.analyticsContext, "string");
    assert.equal(page.article.analyticsContext?.startsWith("v1."), true);

    const verified = verifyAnalyticsContextToken({
      token: page.article.analyticsContext ?? "",
      signingKey: SIGNING_KEY,
    });
    assert.equal(verified.ok, true);
    if (!verified.ok) {
      return;
    }
    assert.equal(verified.value.surface, ANALYTICS_SURFACE.ARTICLE);
    assert.equal(verified.value.contentItemId, page.article.id);
    assert.equal(verified.value.publishedVersionId, page.article.publishedVersionId);
  });

  it("does not invent a live article context for withdrawn or redirect pages", () => {
    assert.equal(
      attachPublicArticleAnalyticsContext(null, { signingKey: SIGNING_KEY }),
      null,
    );
    const withdrawn = attachPublicArticleAnalyticsContext(
      {
        status: "withdrawn",
        shell: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          slug: "haber",
          title: "Withdrawn",
          publishedAt: new Date("2026-08-18T00:00:00.000Z"),
          effectiveAt: new Date("2026-08-19T00:00:00.000Z"),
          withdrawalKind: "RETRACTION",
          publicNote: null,
        },
      },
      { signingKey: SIGNING_KEY },
    );
    assert.equal(withdrawn?.status, "withdrawn");

    const redirect = attachPublicArticleAnalyticsContext(
      {
        status: "redirect",
        toSlug: "yeni-haber",
        contentItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      { signingKey: SIGNING_KEY },
    );
    assert.equal(redirect?.status, "redirect");
  });
});
