import { isUuid } from "../editor/query-bounds";
import { publicArticleCanonicalUrl, publicHomepageCanonicalUrl } from "./canonical";
import { isPublicSitemapEligible, type PublicIndexabilityInput } from "./indexability";

export const SITEMAP_PAGE_DEFAULT_LIMIT = 1000;
export const SITEMAP_PAGE_MAX_LIMIT = 5000;

/**
 * Public sitemap shard size. Shard 0 includes the homepage plus the first
 * article page. Later shards are article-only. Random access to shard N uses
 * SQL OFFSET (N * SITEMAP_SHARD_SIZE), which is acceptable well below
 * Google's 50,000 URL / sitemap cap and cheaper than loading the catalog
 * into one in-memory document.
 */
export const SITEMAP_SHARD_SIZE = SITEMAP_PAGE_DEFAULT_LIMIT;

export type PublicSitemapEntry = {
  loc: string;
  lastModified: Date | null;
};

export type PublicSitemapArticleSource = PublicIndexabilityInput & {
  slug: string;
  publishedAt: Date | string | null;
  publicDateModified: Date | string | null;
};

export type PublicSitemapPage = {
  entries: PublicSitemapEntry[];
  nextCursor: string | null;
};

export function clampSitemapPageLimit(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw) || raw < 1) {
    return SITEMAP_PAGE_DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(raw), SITEMAP_PAGE_MAX_LIMIT);
}

export function sitemapLastModified(input: {
  publicDateModified: Date | string | null;
  publishedAt: Date | string | null;
}): Date | null {
  const preferred = input.publicDateModified ?? input.publishedAt;
  if (preferred == null) {
    return null;
  }

  const date = preferred instanceof Date ? preferred : new Date(preferred);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toPublicSitemapArticleEntry(
  input: PublicSitemapArticleSource,
  trustedSiteUrl: string,
): PublicSitemapEntry | null {
  if (!isPublicSitemapEligible(input)) {
    return null;
  }

  return {
    loc: publicArticleCanonicalUrl(trustedSiteUrl, input.slug),
    lastModified: sitemapLastModified({
      publicDateModified: input.publicDateModified,
      publishedAt: input.publishedAt,
    }),
  };
}

export function publicHomepageSitemapEntry(
  trustedSiteUrl: string,
): PublicSitemapEntry {
  return {
    loc: publicHomepageCanonicalUrl(trustedSiteUrl),
    lastModified: null,
  };
}

export type SitemapCursor = {
  publishedAt: string;
  id: string;
};

export function encodeSitemapCursor(input: {
  publishedAt: Date | string;
  id: string;
}): string {
  const publishedAt =
    input.publishedAt instanceof Date
      ? input.publishedAt.toISOString()
      : new Date(input.publishedAt).toISOString();

  return Buffer.from(
    JSON.stringify({ publishedAt, id: input.id }),
    "utf8",
  ).toString("base64url");
}

export function publicSitemapShardCount(articleCount: number): number {
  const safe = Number.isFinite(articleCount)
    ? Math.max(0, Math.floor(articleCount))
    : 0;
  return Math.max(1, Math.ceil(safe / SITEMAP_SHARD_SIZE));
}

export function publicSitemapShardOffset(shardId: number): number {
  if (!Number.isInteger(shardId) || shardId < 0) {
    return 0;
  }
  return shardId * SITEMAP_SHARD_SIZE;
}

export function parsePublicSitemapShardId(
  raw: string | number | undefined,
): number | null {
  if (raw === undefined) {
    return null;
  }
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 0) {
      return null;
    }
    return raw;
  }

  const match = String(raw)
    .trim()
    .match(/^(\d+)(?:\.xml)?$/);
  if (!match) {
    return null;
  }

  const id = Number.parseInt(match[1], 10);
  if (!Number.isInteger(id) || id < 0) {
    return null;
  }
  return id;
}

export function decodeSitemapCursor(raw: string | undefined): SitemapCursor | null {
  if (raw === undefined || raw.length === 0) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("publishedAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.publishedAt !== "string" ||
      typeof parsed.id !== "string" ||
      !isUuid(parsed.id) ||
      Number.isNaN(new Date(parsed.publishedAt).getTime())
    ) {
      return null;
    }

    return { publishedAt: parsed.publishedAt, id: parsed.id };
  } catch {
    return null;
  }
}
