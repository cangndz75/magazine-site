import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { unstable_cache } from "next/cache";
import type { PublicArticle, PublicArticlePage } from "@magazine/db/public";
import {
  PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS,
  cachedPublicArticleLoader,
  type PublicArticlePageLoader,
} from "./public-article-cache";

type CacheOptions = Parameters<typeof unstable_cache>[2];

function fakeCachedArticle(title: string, id = "content-1"): PublicArticle {
  return {
    id,
    slug: "haber",
    title,
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
    legalNotices: [],
  };
}

function livePage(article: PublicArticle): PublicArticlePage {
  return { status: "live", article };
}

class TaggedCache {
  readonly calls: { keyParts?: string[]; options?: CacheOptions }[] = [];
  private readonly values = new Map<string, unknown>();
  private readonly tagsByKey = new Map<string, string[]>();

  factory: typeof unstable_cache = ((cb, keyParts, options) => {
    this.calls.push({ keyParts, options });
    return (async (...args: unknown[]) => {
      const key = JSON.stringify([keyParts, args]);
      if (this.values.has(key)) {
        return this.values.get(key);
      }

      const value = await cb(...args);
      this.values.set(key, JSON.parse(JSON.stringify(value)));
      this.tagsByKey.set(key, options?.tags ?? []);
      return value;
    }) as ReturnType<typeof unstable_cache>;
  }) as typeof unstable_cache;

  invalidateTag(tag: string): void {
    for (const [key, tags] of this.tagsByKey.entries()) {
      if (tags.includes(tag)) {
        this.values.delete(key);
        this.tagsByKey.delete(key);
      }
    }
  }
}

describe("public article shared cache wrapper", () => {
  it("reuses the cached public article result for repeated unchanged reads", async () => {
    const cache = new TaggedCache();
    let resolverCalls = 0;
    const load: PublicArticlePageLoader = async () => {
      resolverCalls += 1;
      return livePage(fakeCachedArticle("Title 1"));
    };

    const first = await cachedPublicArticleLoader("haber", load, cache.factory);
    const second = await cachedPublicArticleLoader("haber", load, cache.factory);

    assert.equal(resolverCalls, 2);
    assert.equal(first?.status, "live");
    if (first?.status !== "live") {
      throw new Error("expected live page");
    }
    assert.equal(first.article.title, "Title 1");
    assert.equal(second?.status, "live");
    if (second?.status !== "live") {
      throw new Error("expected live page");
    }
    assert.equal(second.article.title, "Title 1");
    assert.equal(second.article.publishedAt instanceof Date, true);
    assert.deepEqual(cache.calls[0]?.keyParts, [
      "public-article-identity",
      "article-slug:haber",
    ]);
    assert.deepEqual(cache.calls[0]?.options, {
      revalidate: PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS,
      tags: ["article-slug:haber"],
    });
    assert.deepEqual(cache.calls[1]?.keyParts, [
      "public-article",
      "article-slug:haber",
      "content:content-1",
    ]);
    assert.deepEqual(cache.calls[1]?.options, {
      revalidate: PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS,
      tags: ["article-slug:haber", "content:content-1"],
    });
  });

  it("refreshes the next read after slug tag invalidation, including cached null", async () => {
    const cache = new TaggedCache();
    let resolverCalls = 0;
    let current: PublicArticlePage | null = livePage(fakeCachedArticle("Old"));
    const load: PublicArticlePageLoader = async () => {
      resolverCalls += 1;
      return current;
    };

    const first = await cachedPublicArticleLoader("haber", load, cache.factory);
    current = null;
    cache.invalidateTag("article-slug:haber");
    const second = await cachedPublicArticleLoader("haber", load, cache.factory);

    assert.equal(first?.status, "live");
    if (first?.status !== "live") {
      throw new Error("expected live page");
    }
    assert.equal(first.article.title, "Old");
    assert.equal(second, null);
    assert.equal(resolverCalls, 3);
  });

  it("refreshes article HTML after content-level invalidation even if the slug identity remains", async () => {
    const cache = new TaggedCache();
    let resolverCalls = 0;
    let current = "Hero A";
    const load: PublicArticlePageLoader = async () => {
      resolverCalls += 1;
      return livePage(fakeCachedArticle(current));
    };

    const first = await cachedPublicArticleLoader("haber", load, cache.factory);
    current = "Hero B";
    cache.invalidateTag("content:content-1");
    const second = await cachedPublicArticleLoader("haber", load, cache.factory);

    assert.equal(first?.status, "live");
    if (first?.status !== "live") {
      throw new Error("expected live page");
    }
    assert.equal(first.article.title, "Hero A");
    assert.equal(second?.status, "live");
    if (second?.status !== "live") {
      throw new Error("expected live page");
    }
    assert.equal(second.article.title, "Hero B");
    assert.equal(resolverCalls, 3);
  });

  it("defaults missing gallery and videos on restored cache payloads", async () => {
    const cache = new TaggedCache();
    const load: PublicArticlePageLoader = async () => {
      const stale = { ...fakeCachedArticle("Old shape") } as Record<string, unknown>;
      delete stale.gallery;
      delete stale.videos;
      delete stale.legalNotices;
      return livePage(stale as unknown as PublicArticle);
    };

    const result = await cachedPublicArticleLoader("haber", load, cache.factory);

    assert.equal(result?.status, "live");
    if (result?.status !== "live") {
      throw new Error("expected live page");
    }
    assert.equal(result.article.title, "Old shape");
    assert.deepEqual(result.article.gallery, []);
    assert.deepEqual(result.article.videos, []);
    assert.deepEqual(result.article.legalNotices, []);
  });

  it("does not cache malformed slugs", async () => {
    const cache = new TaggedCache();
    let resolverCalls = 0;
    const load: PublicArticlePageLoader = async () => {
      resolverCalls += 1;
      return null;
    };

    await cachedPublicArticleLoader("Hello World", load, cache.factory);
    await cachedPublicArticleLoader("Hello World", load, cache.factory);

    assert.equal(resolverCalls, 2);
    assert.equal(cache.calls.length, 0);
  });

  it("caches a historical slug redirect under the old slug and content identity", async () => {
    const cache = new TaggedCache();
    const load: PublicArticlePageLoader = async () => ({
      status: "redirect",
      toSlug: "yeni-haber",
      contentItemId: "content-1",
    });

    const first = await cachedPublicArticleLoader("eski-haber", load, cache.factory);
    const second = await cachedPublicArticleLoader("eski-haber", load, cache.factory);

    assert.deepEqual(first, {
      status: "redirect",
      toSlug: "yeni-haber",
      contentItemId: "content-1",
    });
    assert.deepEqual(second, first);
    assert.deepEqual(cache.calls[0]?.keyParts, [
      "public-article-identity",
      "article-slug:eski-haber",
    ]);
    assert.deepEqual(cache.calls[1]?.options?.tags, [
      "article-slug:eski-haber",
      "content:content-1",
    ]);
  });
});
