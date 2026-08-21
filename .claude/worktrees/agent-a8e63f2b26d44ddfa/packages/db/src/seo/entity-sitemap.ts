import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  ENTITY_STATUS,
  clampSitemapPageLimit,
  publicEntityCanonicalUrl,
  sitemapLastModified,
  type PublicSitemapEntry,
  type PublicSitemapPage,
} from "@magazine/domain";
import { getDb } from "../client";
import { entities } from "../schema/entities";

export type ListPublicSitemapEntitiesInput = {
  trustedSiteUrl: string;
  limit?: number;
  offset?: number;
};

function publicEntitySitemapConditions() {
  return [
    eq(entities.status, ENTITY_STATUS.ACTIVE),
    isNull(entities.deletedAt),
    isNull(entities.mergedIntoEntityId),
  ];
}

export async function countPublicSitemapEntities(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(entities)
    .where(and(...publicEntitySitemapConditions()));

  return row?.count ?? 0;
}

/**
 * ACTIVE public entity profiles only. Current slug, never historical slugs.
 * Ordered by updatedAt so activation, archive, and slug changes move freshness.
 */
export async function listPublicSitemapEntities(
  input: ListPublicSitemapEntitiesInput,
): Promise<PublicSitemapPage> {
  const db = getDb();
  const limit = clampSitemapPageLimit(input.limit);
  const offset =
    input.offset !== undefined && Number.isInteger(input.offset) && input.offset > 0
      ? Math.floor(input.offset)
      : 0;

  const rows = await db
    .select({
      id: entities.id,
      slug: entities.slug,
      updatedAt: entities.updatedAt,
    })
    .from(entities)
    .where(and(...publicEntitySitemapConditions()))
    .orderBy(desc(entities.updatedAt), desc(entities.id))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const entries: PublicSitemapEntry[] = page.map((row) => ({
    loc: publicEntityCanonicalUrl(input.trustedSiteUrl, row.slug),
    lastModified: sitemapLastModified({
      publicDateModified: row.updatedAt,
      publishedAt: row.updatedAt,
    }),
  }));

  return {
    entries,
    nextCursor: null,
  };
}
