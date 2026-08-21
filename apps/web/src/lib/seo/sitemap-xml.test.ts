import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializeSitemapIndex, serializeSitemapUrlset } from "./sitemap-xml";

describe("public sitemap xml", () => {
  it("serializes a sitemap index of shard documents", () => {
    const xml = serializeSitemapIndex([
      "https://www.example.com/sitemap/0.xml",
      "https://www.example.com/sitemap/1.xml",
    ]);
    assert.equal(xml.includes("<sitemapindex"), true);
    assert.equal(xml.includes("https://www.example.com/sitemap/0.xml"), true);
    assert.equal(xml.includes("https://www.example.com/sitemap/1.xml"), true);
    assert.equal(xml.includes("<urlset"), false);
  });

  it("serializes urlset entries with optional lastmod", () => {
    const xml = serializeSitemapUrlset([
      { loc: "https://www.example.com", lastModified: null },
      {
        loc: "https://www.example.com/haber",
        lastModified: new Date("2026-08-21T08:00:00.000Z"),
      },
    ]);
    assert.equal(xml.includes("<urlset"), true);
    assert.equal(xml.includes("https://www.example.com/haber"), true);
    assert.equal(xml.includes("<lastmod>2026-08-21T08:00:00.000Z</lastmod>"), true);
  });
});
