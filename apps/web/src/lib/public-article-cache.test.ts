import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { unstable_cache } from "next/cache";
import {
  PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS,
  cachedPublicArticleLoader,
  type PublicArticleLoader,
} from "./public-article-cache";

type CacheOptions = Parameters<typeof unstable_cache>[2];

function fakeCachedArticle(title: string) {
  return {
    id: "content-1",
    slug: "haber",
    title,
    subtitle: null,
    excerpt: null,
    publishedAt: new Date("2026-08-18T00:00:00.000Z"),
    publicDateModified: null,
    body: { blocks: [] },
    hero: null,
    categories: [],
    authors: [],
  };
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
    const load: PublicArticleLoader = async () => {
      resolverCalls += 1;
      return fakeCachedArticle(`Title ${resolverCalls}`);
    };

    const first = await cachedPublicArticleLoader("haber", load, cache.factory);
    const second = await cachedPublicArticleLoader("haber", load, cache.factory);

    assert.equal(resolverCalls, 1);
    assert.equal(first?.title, "Title 1");
    assert.equal(second?.title, "Title 1");
    assert.equal(second?.publishedAt instanceof Date, true);
    assert.deepEqual(cache.calls[0]?.keyParts, [
      "public-article",
      "article-slug:haber",
    ]);
    assert.deepEqual(cache.calls[0]?.options, {
      revalidate: PUBLIC_ARTICLE_CACHE_REVALIDATE_SECONDS,
      tags: ["article-slug:haber"],
    });
  });

  it("refreshes the next read after tag invalidation", async () => {
    const cache = new TaggedCache();
    let resolverCalls = 0;
    const load: PublicArticleLoader = async () => {
      resolverCalls += 1;
      return resolverCalls === 1 ? fakeCachedArticle("Old") : null;
    };

    const first = await cachedPublicArticleLoader("haber", load, cache.factory);
    cache.invalidateTag("article-slug:haber");
    const second = await cachedPublicArticleLoader("haber", load, cache.factory);

    assert.equal(first?.title, "Old");
    assert.equal(second, null);
    assert.equal(resolverCalls, 2);
  });

  it("does not cache malformed slugs", async () => {
    const cache = new TaggedCache();
    let resolverCalls = 0;
    const load: PublicArticleLoader = async () => {
      resolverCalls += 1;
      return null;
    };

    await cachedPublicArticleLoader("Hello World", load, cache.factory);
    await cachedPublicArticleLoader("Hello World", load, cache.factory);

    assert.equal(resolverCalls, 2);
    assert.equal(cache.calls.length, 0);
  });
});
