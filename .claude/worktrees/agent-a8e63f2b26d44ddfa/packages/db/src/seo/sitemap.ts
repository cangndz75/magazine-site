import { and, desc, eq, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import {
  PUBLICATION_STATUS,
  clampSitemapPageLimit,
  decodeSitemapCursor,
  encodeSitemapCursor,
  publicArticleCanonicalUrl,
  sitemapLastModified,
  type PublicSitemapEntry,
  type PublicSitemapPage,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersions } from "../schema/content";

export type ListPublicSitemapEntriesInput = {
  trustedSiteUrl: string;
  limit?: number;
  cursor?: string | null;
  /**
   * Random access for sitemap shards. OFFSET cost grows with shard index;
   * the public catalog is expected to stay far below Google's 50k URL cap.
   * Cursor and offset must not be combined.
   */
  offset?: number;
};

function sitemapEligibilityConditions(): SQL[] {
  return [
    isNull(contentItems.deletedAt),
    isNull(contentItems.retractedAt),
    isNull(contentItems.takedownAt),
    eq(contentItems.publicationStatus, PUBLICATION_STATUS.PUBLISHED),
    isNotNull(contentItems.publishedVersionId),
    isNotNull(contentItems.publishedAt),
    sql`not (
      coalesce(${contentVersions.robots}, '') ~* '(^|[[:space:],;])(noindex|none)([[:space:],;]|$)'
    )`,
  ];
}

export async function countPublicSitemapArticles(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(contentItems)
    .innerJoin(
      contentVersions,
      eq(contentVersions.id, contentItems.publishedVersionId),
    )
    .where(and(...sitemapEligibilityConditions()));

  return row?.count ?? 0;
}

/**
 * Bounded sitemap source-of-truth. Only publicly authoritative, indexable
 * articles are returned. Callers can page with the cursor instead of loading
 * the full publication history.
 */
export async function listPublicSitemapEntries(
  input: ListPublicSitemapEntriesInput,
): Promise<PublicSitemapPage> {
  const db = getDb();
  const limit = clampSitemapPageLimit(input.limit);
  const conditions: SQL[] = sitemapEligibilityConditions();

  const offset =
    input.offset !== undefined && Number.isInteger(input.offset) && input.offset > 0
      ? Math.floor(input.offset)
      : 0;
  const cursor = offset > 0 ? null : decodeSitemapCursor(input.cursor ?? undefined);
  if (cursor) {
    const cursorPublishedAt = new Date(cursor.publishedAt);
    const cursorClause = or(
      lt(contentItems.publishedAt, cursorPublishedAt),
      and(
        eq(contentItems.publishedAt, cursorPublishedAt),
        lt(contentItems.id, cursor.id),
      ),
    );
    if (cursorClause) {
      conditions.push(cursorClause);
    }
  }

  const rows = await db
    .select({
      id: contentItems.id,
      slug: contentItems.slug,
      publishedAt: contentItems.publishedAt,
      publicDateModified: contentItems.publicDateModified,
    })
    .from(contentItems)
    .innerJoin(
      contentVersions,
      eq(contentVersions.id, contentItems.publishedVersionId),
    )
    .where(and(...conditions))
    .orderBy(desc(contentItems.publishedAt), desc(contentItems.id))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const entries: PublicSitemapEntry[] = page.map((row) => ({
    loc: publicArticleCanonicalUrl(input.trustedSiteUrl, row.slug),
    lastModified: sitemapLastModified({
      publicDateModified: row.publicDateModified,
      publishedAt: row.publishedAt,
    }),
  }));

  const last = page[page.length - 1];
  return {
    entries,
    nextCursor:
      hasMore && last && last.publishedAt
        ? encodeSitemapCursor({ publishedAt: last.publishedAt, id: last.id })
        : null,
  };
}
