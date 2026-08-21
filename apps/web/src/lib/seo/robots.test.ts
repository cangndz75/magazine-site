import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PUBLICATION_STATUS,
  SEO_APP_ENV,
  buildPublicRobotsDocument,
  publicHomepageSitemapEntry,
  toPublicSitemapArticleEntry,
} from "@magazine/domain";

describe("public robots and sitemap wiring", () => {
  it("keeps production indexable against the configured origin", () => {
    const robots = buildPublicRobotsDocument({
      appEnv: SEO_APP_ENV.PRODUCTION,
      trustedSiteUrl: "https://www.example.com",
    });
    assert.equal(robots.host, "www.example.com");
    assert.equal(robots.sitemap, "https://www.example.com/sitemap.xml");
  });

  it("does not advertise preview hosts as indexable", () => {
    const robots = buildPublicRobotsDocument({
      appEnv: SEO_APP_ENV.STAGING,
      trustedSiteUrl: "https://preview.example.com",
    });
    assert.deepEqual(robots.rules, { userAgent: "*", disallow: "/" });
  });

  it("uses the trusted public origin for sitemap loc values", () => {
    const home = publicHomepageSitemapEntry("https://www.example.com");
    const article = toPublicSitemapArticleEntry(
      {
        slug: "kanonik-haber",
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: "11111111-1111-4111-8111-111111111111",
        publishedAt: new Date("2026-03-01T10:00:00.000Z"),
        publicDateModified: new Date("2026-03-02T11:30:00.000Z"),
        deletedAt: null,
        retractedAt: null,
        takedownAt: null,
      },
      "https://www.example.com",
    );
    assert.equal(home.loc, "https://www.example.com");
    assert.equal(article?.loc, "https://www.example.com/kanonik-haber");
    assert.equal(article?.loc.includes("evil.example"), false);
  });

  it("serves the sitemap index and shards from request-time route handlers", () => {
    const indexSource = readFileSync(
      fileURLToPath(new URL("../../app/sitemap.xml/route.ts", import.meta.url)),
      "utf8",
    );
    const shardSource = readFileSync(
      fileURLToPath(new URL("../../app/sitemap/[id]/route.ts", import.meta.url)),
      "utf8",
    );
    assert.equal(indexSource.includes("force-dynamic"), true);
    assert.equal(shardSource.includes("force-dynamic"), true);
    assert.equal(indexSource.includes("generateSitemaps"), false);
    assert.equal(shardSource.includes("generateSitemaps"), false);
  });
});
