import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolvePublicMetadataDescription,
  resolvePublicMetadataTitle,
} from "./metadata";

describe("public metadata authority", () => {
  it("uses seoTitle when non-empty and falls back to the article title", () => {
    assert.equal(
      resolvePublicMetadataTitle({
        seoTitle: " Kanonik başlık ",
        title: "Görünen H1",
      }),
      "Kanonik başlık",
    );
    assert.equal(
      resolvePublicMetadataTitle({ seoTitle: "   ", title: "Görünen H1" }),
      "Görünen H1",
    );
    assert.equal(
      resolvePublicMetadataTitle({ seoTitle: null, title: "Görünen H1" }),
      "Görünen H1",
    );
  });

  it("uses seoDescription, then excerpt, then subtitle, and never fabricates body text", () => {
    assert.equal(
      resolvePublicMetadataDescription({
        seoDescription: " SEO açıklaması ",
        excerpt: "Özet",
        subtitle: "Deck",
      }),
      "SEO açıklaması",
    );
    assert.equal(
      resolvePublicMetadataDescription({
        seoDescription: "  ",
        excerpt: "Özet",
        subtitle: "Deck",
      }),
      "Özet",
    );
    assert.equal(
      resolvePublicMetadataDescription({
        seoDescription: null,
        excerpt: null,
        subtitle: "Deck",
      }),
      "Deck",
    );
    assert.equal(
      resolvePublicMetadataDescription({
        seoDescription: null,
        excerpt: "  ",
        subtitle: null,
      }),
      null,
    );
  });
});
