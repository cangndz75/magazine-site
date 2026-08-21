import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS } from "../public-article-cache";

const root = fileURLToPath(new URL("../..", import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("analytics server-first boundary", () => {
  it("keeps public article and homepage pages as server modules", () => {
    const article = read("app/[slug]/page.tsx");
    const homepage = read("app/page.tsx");
    assert.equal(article.includes("import \"server-only\""), false);
    assert.equal(read("lib/public-article.ts").includes("import \"server-only\""), true);
    assert.equal(read("lib/public-homepage.ts").includes("import \"server-only\""), true);
    assert.equal(article.trimStart().startsWith("\"use client\""), false);
    assert.equal(homepage.trimStart().startsWith("\"use client\""), false);
    assert.equal(read("components/analytics/analytics-page-view.tsx").startsWith("\"use client\""), true);
    assert.equal(
      read("components/analytics/analytics-homepage-placement.tsx").startsWith("\"use client\""),
      true,
    );
  });

  it("does not move article loading or SEO metadata to the browser", () => {
    const article = read("app/[slug]/page.tsx");
    assert.equal(article.includes("generateMetadata"), true);
    assert.equal(article.includes("buildPublicArticlePageSeo"), true);
    assert.equal(article.includes("getPublicArticlePageBySlug"), true);
    assert.equal(article.includes("draftVersionId"), false);
    assert.equal(PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS, false);
  });
});
