import { and, eq, isNull } from "drizzle-orm";
import {
  canonicalizeContentSlug,
  MEDIA_ROLE,
  MEDIA_TYPE,
  PUBLICATION_STATUS,
  publicPublishedVersionId,
  type AuthorRole,
} from "@magazine/domain";
import { getDb } from "../client";
import { authors } from "../schema/authors";
import {
  contentItems,
  contentVersionAuthors,
  contentVersionCategories,
  contentVersionMedia,
  contentVersions,
} from "../schema/content";
import { media } from "../schema/media";
import { categories } from "../schema/taxonomy";

export type PublicArticleCategory = {
  name: string;
  slug: string;
  isPrimary: boolean;
};

export type PublicArticleAuthor = {
  displayName: string;
  slug: string;
  role: AuthorRole;
};

export type PublicArticleHeroMedia = {
  url: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  credit: string | null;
};

export type PublicArticle = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  publishedAt: Date;
  publicDateModified: Date | null;
  body: unknown;
  hero: PublicArticleHeroMedia | null;
  categories: PublicArticleCategory[];
  authors: PublicArticleAuthor[];
};

export type PublicArticleReadOptions = {
  mediaPublicBaseUrl?: string;
};

function resolvePublicMediaUrl(
  mediaPublicBaseUrl: string | undefined,
  storageKey: string,
): string | null {
  const trimmedBase = mediaPublicBaseUrl?.trim();
  const trimmedKey = storageKey.trim();
  if (!trimmedBase || !trimmedKey) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmedBase);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  const basePath = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  const publicPath = trimmedKey
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  if (!publicPath) {
    return null;
  }

  url.pathname = `${basePath}${publicPath}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

/**
 * Public readers resolve by the item's canonical slug, then only through
 * publicationStatus === PUBLISHED and publishedVersionId.
 * Draft, review, scheduled, and unpublished pointers are never substituted.
 */
export async function getPublicArticleBySlug(
  rawSlug: string,
  options: PublicArticleReadOptions = {},
): Promise<PublicArticle | null> {
  const canonical = canonicalizeContentSlug(rawSlug);
  if (!canonical.ok) {
    return null;
  }

  const db = getDb();
  const [item] = await db
    .select({
      id: contentItems.id,
      slug: contentItems.slug,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      publishedAt: contentItems.publishedAt,
      publicDateModified: contentItems.publicDateModified,
      deletedAt: contentItems.deletedAt,
    })
    .from(contentItems)
    .where(
      and(
        eq(contentItems.slug, canonical.value),
        isNull(contentItems.deletedAt),
        eq(contentItems.publicationStatus, PUBLICATION_STATUS.PUBLISHED),
      ),
    )
    .limit(1);

  if (!item) {
    return null;
  }

  const publishedVersionId = publicPublishedVersionId(item);
  if (!publishedVersionId || item.publishedAt === null) {
    return null;
  }

  const [version] = await db
    .select({
      id: contentVersions.id,
      title: contentVersions.title,
      subtitle: contentVersions.subtitle,
      excerpt: contentVersions.excerpt,
      body: contentVersions.body,
    })
    .from(contentVersions)
    .where(
      and(
        eq(contentVersions.id, publishedVersionId),
        eq(contentVersions.contentItemId, item.id),
      ),
    )
    .limit(1);

  if (!version) {
    return null;
  }

  const [categoryRows, authorRows, heroRows] = await Promise.all([
    db
      .select({
        name: categories.name,
        slug: categories.slug,
        isPrimary: contentVersionCategories.isPrimary,
      })
      .from(contentVersionCategories)
      .innerJoin(
        categories,
        eq(categories.id, contentVersionCategories.categoryId),
      )
      .where(eq(contentVersionCategories.contentVersionId, version.id)),
    db
      .select({
        displayName: authors.displayName,
        slug: authors.slug,
        role: contentVersionAuthors.role,
        sortOrder: contentVersionAuthors.sortOrder,
      })
      .from(contentVersionAuthors)
      .innerJoin(authors, eq(authors.id, contentVersionAuthors.authorId))
      .where(eq(contentVersionAuthors.contentVersionId, version.id))
      .orderBy(contentVersionAuthors.sortOrder),
    db
      .select({
        storageKey: media.storageKey,
        mediaType: media.mediaType,
        width: media.width,
        height: media.height,
        altText: contentVersionMedia.altText,
        credit: contentVersionMedia.credit,
      })
      .from(contentVersionMedia)
      .innerJoin(media, eq(media.id, contentVersionMedia.mediaId))
      .where(
        and(
          eq(contentVersionMedia.contentVersionId, version.id),
          eq(contentVersionMedia.role, MEDIA_ROLE.HERO),
          eq(media.mediaType, MEDIA_TYPE.IMAGE),
        ),
      )
      .limit(1),
  ]);

  const publicCategories = [...categoryRows].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }
    return left.name.localeCompare(right.name, "tr");
  });
  const heroRow = heroRows[0];
  const heroUrl = heroRow
    ? resolvePublicMediaUrl(options.mediaPublicBaseUrl, heroRow.storageKey)
    : null;

  return {
    id: item.id,
    slug: item.slug,
    title: version.title,
    subtitle: version.subtitle,
    excerpt: version.excerpt,
    publishedAt: item.publishedAt,
    publicDateModified: item.publicDateModified,
    body: version.body,
    hero:
      heroRow && heroUrl
        ? {
            url: heroUrl,
            width: heroRow.width,
            height: heroRow.height,
            altText: heroRow.altText,
            credit: heroRow.credit,
          }
        : null,
    categories: publicCategories,
    authors: authorRows.map((row) => ({
      displayName: row.displayName,
      slug: row.slug,
      role: row.role,
    })),
  };
}
