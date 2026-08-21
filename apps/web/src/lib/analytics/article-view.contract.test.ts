import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ANALYTICS_EVENT_NAME } from "@magazine/domain/analytics-client";

const root = fileURLToPath(new URL("../..", import.meta.url));

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("public article analytics emission contract", () => {
  it("emits ARTICLE_VIEW from the live public article page island", () => {
    const page = read("app/[slug]/page.tsx");
    const loader = read("lib/public-article.ts");
    assert.equal(page.includes("AnalyticsArticleView"), true);
    assert.equal(page.includes("article.id"), true);
    assert.equal(page.includes("article.slug"), true);
    assert.equal(page.trimStart().startsWith("\"use client\""), false);
    assert.equal(page.includes("getPublicArticlePageBySlug"), true);
    assert.equal(page.includes("generateMetadata"), true);
    assert.equal(loader.includes("attachPublicArticleAnalyticsContext"), true);
    assert.equal(loader.includes("cachedPublicArticleLoader"), true);
  });

  it("does not emit ARTICLE_VIEW for withdrawn shells or 404", () => {
    const page = read("app/[slug]/page.tsx");
    const withdrawn = read("components/public-withdrawn-article-shell.tsx");
    const notFound = read("app/[slug]/not-found.tsx");

    assert.equal(page.includes("PublicWithdrawnArticleShellView"), true);
    assert.equal(page.includes("AnalyticsArticleView"), true);
    assert.equal(withdrawn.includes("AnalyticsArticleView"), false);
    assert.equal(withdrawn.includes("AnalyticsWithdrawnPageView"), true);
    assert.equal(withdrawn.includes(ANALYTICS_EVENT_NAME.ARTICLE_VIEW), false);
    assert.equal(notFound.includes("AnalyticsArticleView"), false);
    assert.equal(notFound.includes("ARTICLE_VIEW"), false);
  });

  it("redirects historical slugs before any article view island can mount", () => {
    const page = read("app/[slug]/page.tsx");
    const redirectIndex = page.indexOf("permanentRedirect");
    const viewIndex = page.indexOf("AnalyticsArticleView");
    assert.equal(redirectIndex > -1, true);
    assert.equal(viewIndex > redirectIndex, true);
    assert.equal(page.includes('page?.status === "redirect"'), true);
  });
});
