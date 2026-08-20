import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Metadata } from "next";
import {
  articleSeoDescription,
  buildPublicArticlePageSeo,
  buildPublicArticleSeo,
  serializeJsonLd,
  type ArticleSeoInput,
} from "./article-seo";

const SITE_URL = "https://www.example.com";

function publishedArticle(
  overrides: Partial<ArticleSeoInput> = {},
): ArticleSeoInput {
  return {
    slug: "kanonik-haber",
    title: "Yayınlanan haber",
    subtitle: "Deck metni",
    excerpt: "Özet metni",
    publishedAt: new Date("2026-03-01T10:00:00.000Z"),
    publicDateModified: new Date("2026-03-02T11:30:00.000Z"),
    hero: null,
    categories: [{ name: "Gündem", slug: "gundem", isPrimary: true }],
    authors: [{ displayName: "Ayşe Yazar", slug: "ayse-yazar" }],
    ...overrides,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  return value as Record<string, unknown>;
}

function openGraphRecord(metadata: Metadata): Record<string, unknown> {
  assert.ok(metadata.openGraph);
  return metadata.openGraph as Record<string, unknown>;
}

function twitterRecord(metadata: Metadata): Record<string, unknown> {
  assert.ok(metadata.twitter);
  return metadata.twitter as Record<string, unknown>;
}

describe("public article SEO", () => {
  it("uses the canonical article slug, not request input, for canonical and OG URLs", () => {
    const seo = buildPublicArticleSeo(publishedArticle(), SITE_URL);
    const expected = "https://www.example.com/kanonik-haber";
    assert.equal(seo.metadata.alternates?.canonical, expected);
    assert.equal(seo.metadata.openGraph?.url, expected);
    assert.equal(asRecord(seo.jsonLd).url, expected);
  });

  it("takes title and description from the public read model", () => {
    const withExcerpt = buildPublicArticleSeo(publishedArticle(), SITE_URL);
    assert.equal(withExcerpt.metadata.title, "Yayınlanan haber");
    assert.equal(withExcerpt.metadata.description, "Özet metni");
    assert.equal(withExcerpt.metadata.openGraph?.title, "Yayınlanan haber");
    assert.equal(withExcerpt.metadata.openGraph?.description, "Özet metni");
    assert.equal(withExcerpt.metadata.twitter?.title, "Yayınlanan haber");
    assert.equal(withExcerpt.metadata.twitter?.description, "Özet metni");

    const excerptWins = articleSeoDescription(
      publishedArticle({ excerpt: "Özet", subtitle: "Deck" }),
    );
    assert.equal(excerptWins, "Özet");

    const deckFallback = buildPublicArticleSeo(
      publishedArticle({ excerpt: null }),
      SITE_URL,
    );
    assert.equal(deckFallback.metadata.description, "Deck metni");
  });

  it("maps published and modified timestamps without substituting one for the other", () => {
    const seo = buildPublicArticleSeo(publishedArticle(), SITE_URL);
    const openGraph = openGraphRecord(seo.metadata);
    assert.equal(openGraph.type, "article");
    assert.equal(openGraph.publishedTime, "2026-03-01T10:00:00.000Z");
    assert.equal(openGraph.modifiedTime, "2026-03-02T11:30:00.000Z");
    assert.equal(asRecord(seo.jsonLd).datePublished, "2026-03-01T10:00:00.000Z");
    assert.equal(asRecord(seo.jsonLd).dateModified, "2026-03-02T11:30:00.000Z");
  });

  it("derives author and category metadata only from public article data", () => {
    const seo = buildPublicArticleSeo(publishedArticle(), SITE_URL);
    const openGraph = openGraphRecord(seo.metadata);
    assert.deepEqual(seo.metadata.authors, [{ name: "Ayşe Yazar" }]);
    assert.equal(seo.metadata.category, "Gündem");
    assert.deepEqual(openGraph.authors, ["Ayşe Yazar"]);
    assert.equal(openGraph.section, "Gündem");

    const jsonLd = asRecord(seo.jsonLd);
    assert.deepEqual(jsonLd.author, [{ "@type": "Person", name: "Ayşe Yazar" }]);
    assert.equal(jsonLd.articleSection, "Gündem");
    assert.equal("slug" in jsonLd, false);
  });

  it("does not produce article SEO for non-public or missing content", () => {
    const seo = buildPublicArticleSeo(null, SITE_URL);
    assert.equal(seo.metadata.title, "Yazı bulunamadı");
    assert.equal(seo.metadata.alternates, undefined);
    assert.equal(seo.metadata.openGraph, undefined);
    assert.equal(seo.metadata.twitter, undefined);
    assert.equal(seo.metadata.authors, undefined);
    assert.equal(seo.metadata.category, undefined);
    assert.deepEqual(seo.metadata.robots, { index: false, follow: false });
    assert.equal(seo.jsonLd, null);
    assert.equal(seo.jsonLdScript, null);
  });

  it("adds hero image metadata only when the public article has a hero URL", () => {
    const seo = buildPublicArticleSeo(
      publishedArticle({
        hero: {
          url: "https://media.example.com/assets/hero.jpg",
          width: 1200,
          height: 675,
          altText: "Hero alt",
        },
      }),
      SITE_URL,
    );

    const twitter = twitterRecord(seo.metadata);
    assert.equal(twitter.card, "summary_large_image");
    assert.deepEqual(twitter.images, [
      "https://media.example.com/assets/hero.jpg",
    ]);
    assert.deepEqual(seo.metadata.openGraph?.images, [
      {
        url: "https://media.example.com/assets/hero.jpg",
        width: 1200,
        height: 675,
        alt: "Hero alt",
      },
    ]);
    assert.equal(asRecord(seo.jsonLd).image, "https://media.example.com/assets/hero.jpg");
  });

  it("puts the canonical published article URL in JSON-LD", () => {
    const seo = buildPublicArticleSeo(publishedArticle(), SITE_URL);
    assert.notEqual(seo.jsonLd, null);
    const jsonLd = asRecord(seo.jsonLd);
    assert.equal(jsonLd["@type"], "NewsArticle");
    assert.equal(jsonLd.url, "https://www.example.com/kanonik-haber");
    assert.deepEqual(jsonLd.mainEntityOfPage, {
      "@type": "WebPage",
      "@id": "https://www.example.com/kanonik-haber",
    });
    assert.equal(jsonLd.headline, "Yayınlanan haber");
    assert.equal(seo.jsonLdScript?.includes("https://www.example.com/kanonik-haber"), true);
  });

  it("serializes JSON-LD so unsafe content cannot break out of the script element", () => {
    const seo = buildPublicArticleSeo(
      publishedArticle({
        title: "</script><script>alert(1)</script>",
        excerpt: "foo & bar > baz",
      }),
      SITE_URL,
    );
    assert.notEqual(seo.jsonLdScript, null);
    const script = seo.jsonLdScript ?? "";
    assert.equal(script.includes("</script>"), false);
    assert.equal(script.includes("<script>"), false);
    assert.equal(script.includes("alert(1)"), true);
    assert.equal(script.includes("\\u003c"), true);
    assert.equal(script.includes("&"), false);

    const serialized = serializeJsonLd({
      headline: "</script><script>alert(1)</script>",
    });
    assert.equal(serialized.includes("</script>"), false);
    assert.equal(JSON.parse(serialized).headline, "</script><script>alert(1)</script>");
  });

  it("omits missing optional fields instead of fabricating values", () => {
    const seo = buildPublicArticleSeo(
      publishedArticle({
        excerpt: "   ",
        subtitle: null,
        publicDateModified: null,
        authors: [],
        categories: [{ name: "Yan kategori", slug: "yan", isPrimary: false }],
      }),
      SITE_URL,
    );

    assert.equal(seo.metadata.description, undefined);
    assert.equal(seo.metadata.openGraph?.description, undefined);
    assert.equal(seo.metadata.twitter?.description, undefined);
    const openGraph = openGraphRecord(seo.metadata);
    assert.equal(seo.metadata.authors, undefined);
    assert.equal(seo.metadata.category, undefined);
    assert.equal(openGraph.modifiedTime, undefined);
    assert.equal(openGraph.authors, undefined);
    assert.equal(openGraph.section, undefined);

    const jsonLd = asRecord(seo.jsonLd);
    assert.equal("description" in jsonLd, false);
    assert.equal("dateModified" in jsonLd, false);
    assert.equal("author" in jsonLd, false);
    assert.equal("articleSection" in jsonLd, false);
    assert.equal("publisher" in jsonLd, false);
    assert.equal("image" in jsonLd, false);
    assert.equal(jsonLd.datePublished, "2026-03-01T10:00:00.000Z");
    assert.equal(articleSeoDescription({ excerpt: null, subtitle: null }), undefined);
  });

  it("noindexes withdrawn articles without publishing NewsArticle JSON-LD", () => {
    const retracted = buildPublicArticlePageSeo(
      {
        status: "withdrawn",
        shell: {
          id: "item-1",
          slug: "retracted-piece",
          title: "Geri çekilen haber",
          publishedAt: new Date("2026-03-01T10:00:00.000Z"),
          withdrawalKind: "RETRACTION",
          publicNote: "Bu yazı geri çekilmiştir.",
          effectiveAt: new Date("2026-03-05T12:00:00.000Z"),
        },
      },
      SITE_URL,
    );
    assert.equal(retracted.metadata.title, "Geri çekilen haber — Geri çekildi");
    assert.deepEqual(retracted.metadata.robots, { index: false, follow: false });
    assert.equal(retracted.metadata.alternates?.canonical, "https://www.example.com/retracted-piece");
    assert.equal(retracted.jsonLd, null);

    const takedown = buildPublicArticlePageSeo(
      {
        status: "withdrawn",
        shell: {
          id: "item-2",
          slug: "removed-piece",
          title: "Kaldırılan içerik",
          publishedAt: new Date("2026-03-01T10:00:00.000Z"),
          withdrawalKind: "TAKEDOWN",
          publicNote: null,
          effectiveAt: new Date("2026-03-05T12:00:00.000Z"),
        },
      },
      SITE_URL,
    );
    assert.equal(takedown.metadata.title, "Kaldırılan içerik — Yayından kaldırıldı");
    assert.equal(takedown.metadata.description, "Bu içerik yayından kaldırılmıştır.");
  });

  it("keeps correction and clarification articles on the published SEO path", () => {
    const seo = buildPublicArticlePageSeo(
      { status: "live", article: publishedArticle() },
      SITE_URL,
    );
    assert.notEqual(seo.jsonLd, null);
    assert.equal(seo.metadata.alternates?.canonical, "https://www.example.com/kanonik-haber");
    assert.equal(seo.metadata.robots, undefined);
  });
});
