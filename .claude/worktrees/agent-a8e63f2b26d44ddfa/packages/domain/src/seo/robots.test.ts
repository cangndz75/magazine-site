import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SEO_APP_ENV,
  buildEditorRobotsDocument,
  buildPublicRobotsDocument,
  publicSiteAllowsIndexing,
} from "./robots";
import {
  publicHomepageSitemapEntry,
  toPublicSitemapArticleEntry,
} from "./sitemap";
import { PUBLICATION_STATUS } from "../publication-status";

const publishedSource = {
  slug: "kanonik-haber",
  publicationStatus: PUBLICATION_STATUS.PUBLISHED,
  publishedVersionId: "11111111-1111-4111-8111-111111111111",
  publishedAt: new Date("2026-03-01T10:00:00.000Z"),
  publicDateModified: new Date("2026-03-02T11:30:00.000Z"),
  deletedAt: null,
  retractedAt: null,
  takedownAt: null,
};

describe("robots foundation", () => {
  it("allows production public indexing and points at the trusted sitemap", () => {
    const document = buildPublicRobotsDocument({
      appEnv: SEO_APP_ENV.PRODUCTION,
      trustedSiteUrl: "https://www.example.com",
    });
    assert.equal(publicSiteAllowsIndexing(SEO_APP_ENV.PRODUCTION), true);
    assert.deepEqual(document.rules, { userAgent: "*", allow: "/" });
    assert.equal(document.sitemap, "https://www.example.com/sitemap.xml");
    assert.equal(document.host, "www.example.com");
  });

  it("disallows preview, development, and test public surfaces", () => {
    for (const appEnv of [SEO_APP_ENV.DEVELOPMENT, SEO_APP_ENV.TEST, SEO_APP_ENV.STAGING] as const) {
      const document = buildPublicRobotsDocument({
        appEnv,
        trustedSiteUrl: "https://preview.example.com",
      });
      assert.equal(publicSiteAllowsIndexing(appEnv), false);
      assert.deepEqual(document.rules, { userAgent: "*", disallow: "/" });
      assert.equal(document.sitemap, undefined);
    }
  });

  it("always disallows the editor application, including production", () => {
    const document = buildEditorRobotsDocument();
    assert.deepEqual(document.rules, { userAgent: "*", disallow: "/" });
    assert.equal(document.sitemap, undefined);
  });
});

describe("sitemap eligibility", () => {
  it("includes indexable published articles with publicDateModified and the trusted origin", () => {
    const entry = toPublicSitemapArticleEntry(publishedSource, "https://www.example.com");
    assert.deepEqual(entry, {
      loc: "https://www.example.com/kanonik-haber",
      lastModified: new Date("2026-03-02T11:30:00.000Z"),
    });
    assert.equal(
      publicHomepageSitemapEntry("https://www.example.com").loc,
      "https://www.example.com",
    );
  });

  it("excludes drafts, unpublished, retracted, and takedown URLs", () => {
    assert.equal(
      toPublicSitemapArticleEntry(
        {
          ...publishedSource,
          publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
          publishedVersionId: null,
          publishedAt: null,
        },
        "https://www.example.com",
      ),
      null,
    );
    assert.equal(
      toPublicSitemapArticleEntry(
        {
          ...publishedSource,
          publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
        },
        "https://www.example.com",
      ),
      null,
    );
    assert.equal(
      toPublicSitemapArticleEntry(
        {
          ...publishedSource,
          retractedAt: new Date("2026-03-05T00:00:00.000Z"),
        },
        "https://www.example.com",
      ),
      null,
    );
    assert.equal(
      toPublicSitemapArticleEntry(
        {
          ...publishedSource,
          storedRobots: "noindex",
        },
        "https://www.example.com",
      ),
      null,
    );
  });
});
