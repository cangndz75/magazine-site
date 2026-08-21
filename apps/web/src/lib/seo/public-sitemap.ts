import "server-only";

import {
  countPublicSitemapArticles,
  countPublicSitemapEntities,
  listPublicSitemapEntries,
  listPublicSitemapEntities,
} from "@magazine/db/seo";
import {
  SITEMAP_SHARD_SIZE,
  parsePublicSitemapShardId,
  publicHomepageSitemapEntry,
  publicSitemapShardCount,
  publicSitemapShardOffset,
  publicSitemapShardUrl,
  publicSitemapTotalShardCount,
  type PublicSitemapEntry,
} from "@magazine/domain";
import { env } from "@/lib/env";

export async function loadPublicSitemapIndexLocs(): Promise<string[]> {
  const [articleCount, entityCount] = await Promise.all([
    countPublicSitemapArticles(),
    countPublicSitemapEntities(),
  ]);
  const shards = publicSitemapTotalShardCount({ articleCount, entityCount });
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

  const [articleCount, entityCount] = await Promise.all([
    countPublicSitemapArticles(),
    countPublicSitemapEntities(),
  ]);
  const articleShards = publicSitemapShardCount(articleCount);
  const totalShards = publicSitemapTotalShardCount({ articleCount, entityCount });
  if (shardId >= totalShards) {
    return null;
  }

  if (shardId < articleShards) {
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

  const entityShardIndex = shardId - articleShards;
  const result = await listPublicSitemapEntities({
    trustedSiteUrl: env.SITE_URL,
    limit: SITEMAP_SHARD_SIZE,
    offset: publicSitemapShardOffset(entityShardIndex),
  });
  return result.entries;
}
