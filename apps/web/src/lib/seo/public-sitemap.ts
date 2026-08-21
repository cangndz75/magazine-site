import "server-only";

import {
  countPublicSitemapArticles,
  listPublicSitemapEntries,
} from "@magazine/db/seo";
import {
  SITEMAP_SHARD_SIZE,
  parsePublicSitemapShardId,
  publicHomepageSitemapEntry,
  publicSitemapShardCount,
  publicSitemapShardOffset,
  publicSitemapShardUrl,
  type PublicSitemapEntry,
} from "@magazine/domain";
import { env } from "@/lib/env";

export async function loadPublicSitemapIndexLocs(): Promise<string[]> {
  const articleCount = await countPublicSitemapArticles();
  const shards = publicSitemapShardCount(articleCount);
  return Array.from({ length: shards }, (_, id) =>
    publicSitemapShardUrl(env.SITE_URL, id),
  );
}

export async function loadPublicSitemapShard(
  rawId: string | number | undefined,
): Promise<PublicSitemapEntry[] | null> {
  const shardId = parsePublicSitemapShardId(rawId);
  if (shardId === null) {
    return null;
  }

  const articleCount = await countPublicSitemapArticles();
  const shardCount = publicSitemapShardCount(articleCount);
  if (shardId >= shardCount) {
    return null;
  }

  const entries: PublicSitemapEntry[] = [];
  if (shardId === 0) {
    entries.push(publicHomepageSitemapEntry(env.SITE_URL));
  }

  const result = await listPublicSitemapEntries({
    trustedSiteUrl: env.SITE_URL,
    limit: SITEMAP_SHARD_SIZE,
    offset: publicSitemapShardOffset(shardId),
  });
  entries.push(...result.entries);
  return entries;
}
