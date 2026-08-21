import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inspectNewsArticleStructuredData,
  jsonLdScriptIsSafe,
  serializeJsonLd,
  buildNewsArticleJsonLd,
} from "./json-ld";

describe("NewsArticle structured data inspection", () => {
  it("reports a complete inspection when public fields are present without fabricating publisher", () => {
    const inspection = inspectNewsArticleStructuredData({
      suppressed: false,
      headline: "Yayınlanan haber",
      canonicalUrl: "https://www.example.com/haber",
      datePublished: "2026-03-01T10:00:00.000Z",
      dateModified: "2026-03-02T11:30:00.000Z",
      description: "Özet metni yeterince uzun bir açıklama olarak duruyor.",
      authors: ["Ayşe Yazar"],
      imageUrl: "https://media.example.com/hero.jpg",
      articleSection: "Gündem",
      publisherName: null,
    });
    assert.equal(inspection.wouldEmit, true);
    assert.equal(inspection.complete, true);
    assert.equal(inspection.publisherConfigured, false);
    assert.equal(inspection.presentFields.includes("publisher"), false);
    assert.equal(inspection.scriptSafe, true);
  });

  it("emits Organization publisher without fabricating URL or legal identity", () => {
    const jsonLd = buildNewsArticleJsonLd({
      suppressed: false,
      headline: "Yayınlanan haber",
      canonicalUrl: "https://www.example.com/haber",
      datePublished: "2026-03-01T10:00:00.000Z",
      dateModified: "2026-03-02T11:30:00.000Z",
      description: "Özet metni yeterince uzun bir açıklama olarak duruyor.",
      authors: ["Ayşe Yazar"],
      imageUrl: "https://media.example.com/hero.jpg",
      articleSection: "Gündem",
      publisherName: "Dergi",
      publisherUrl: "not-a-url",
      publisherLogoUrl: "https://cdn.example.com/logo.png",
      inLanguage: "tr",
    });
    assert.equal(jsonLd?.["@type"], "NewsArticle");
    assert.deepEqual(jsonLd?.publisher, {
      "@type": "Organization",
      name: "Dergi",
      logo: {
        "@type": "ImageObject",
        url: "https://cdn.example.com/logo.png",
      },
    });
    assert.equal(jsonLd?.inLanguage, "tr");
  });

  it("suppresses JSON-LD for retraction and never emits publisher when name is missing", () => {
    assert.equal(
      buildNewsArticleJsonLd({
        suppressed: true,
        headline: "Geri çekilen",
        canonicalUrl: "https://www.example.com/retracted",
        datePublished: "2026-03-01T10:00:00.000Z",
        dateModified: null,
        description: null,
        authors: ["Ayşe"],
        imageUrl: null,
        articleSection: null,
        publisherName: "Dergi",
      }),
      null,
    );
    const withoutName = buildNewsArticleJsonLd({
      suppressed: false,
      headline: "Yayınlanan haber",
      canonicalUrl: "https://www.example.com/haber",
      datePublished: "2026-03-01T10:00:00.000Z",
      dateModified: null,
      description: null,
      authors: [],
      imageUrl: null,
      articleSection: null,
      publisherName: null,
      publisherUrl: "https://www.example.com",
    });
    assert.equal(withoutName?.publisher, undefined);
  });

  it("reports incomplete NewsArticle data when recommended fields are missing", () => {
    const inspection = inspectNewsArticleStructuredData({
      suppressed: false,
      headline: "Yayınlanan haber",
      canonicalUrl: "https://www.example.com/haber",
      datePublished: "2026-03-01T10:00:00.000Z",
      dateModified: null,
      description: null,
      authors: [],
      imageUrl: null,
      articleSection: null,
      publisherName: null,
    });
    assert.equal(inspection.wouldEmit, true);
    assert.equal(inspection.complete, false);
    assert.deepEqual(inspection.missingRecommendedFields, [
      "description",
      "dateModified",
      "author",
      "image",
      "articleSection",
    ]);
  });

  it("suppresses NewsArticle inspection for retraction and takedown", () => {
    const inspection = inspectNewsArticleStructuredData({
      suppressed: true,
      headline: "Geri çekilen",
      canonicalUrl: "https://www.example.com/retracted",
      datePublished: "2026-03-01T10:00:00.000Z",
      dateModified: null,
      description: null,
      authors: ["Ayşe"],
      imageUrl: null,
      articleSection: null,
      publisherName: null,
    });
    assert.equal(inspection.wouldEmit, false);
    assert.equal(inspection.complete, false);
  });

  it("escapes JSON-LD against script breakout", () => {
    const serialized = serializeJsonLd({
      headline: "</script><script>alert(1)</script>",
    });
    assert.equal(serialized.includes("<"), false);
    assert.equal(serialized.includes(">"), false);
    assert.equal(jsonLdScriptIsSafe(serialized), true);
    assert.equal(serialized.includes("\\u003c"), true);
  });
});
