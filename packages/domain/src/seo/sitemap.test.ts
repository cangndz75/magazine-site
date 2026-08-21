import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SITEMAP_SHARD_SIZE,
  parsePublicSitemapShardId,
  publicSitemapShardCount,
  publicSitemapShardOffset,
} from "./sitemap";

describe("public sitemap shards", () => {
  it("keeps a homepage-only catalog on a single shard", () => {
    assert.equal(SITEMAP_SHARD_SIZE, 1000);
    assert.equal(publicSitemapShardCount(0), 1);
    assert.equal(publicSitemapShardOffset(0), 0);
  });

  it("does not emit an empty extra shard at exact page boundaries", () => {
    assert.equal(publicSitemapShardCount(1000), 1);
    assert.equal(publicSitemapShardCount(1001), 2);
    assert.equal(publicSitemapShardOffset(1), 1000);
  });

  it("rejects malformed shard ids", () => {
    assert.equal(parsePublicSitemapShardId("-1"), null);
    assert.equal(parsePublicSitemapShardId("abc"), null);
    assert.equal(parsePublicSitemapShardId("2abc"), null);
    assert.equal(parsePublicSitemapShardId(2), 2);
    assert.equal(parsePublicSitemapShardId("0.xml"), 0);
    assert.equal(parsePublicSitemapShardId("1.xml"), 1);
  });
});
