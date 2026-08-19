import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  MEDIA_ROLE,
  MEDIA_TYPE,
  PUBLIC_HOMEPAGE_FEATURED_LIMIT,
  PUBLICATION_STATUS,
  emptyHomepageSlotMap,
  publicPublishedVersionId,
  resolvePublicHomepagePlacements,
  selectTemporaryHomepageFeatured,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentVersionCategories,
  contentVersionMedia,
  contentVersions,
} from "../schema/content";
import { media } from "../schema/media";
import { categories } from "../schema/taxonomy";
import { loadPublishedHomepageSlotMap } from "../editor/homepage-builder";
import type {
  PublicArticleHeroMedia,
  PublicArticleReadOptions,
} from "./get-public-article";
import {
  getPublicHomepageConversation,
  type PublicHomepageConversationItem,
} from "./get-public-homepage-conversation";
import { resolvePublicMediaUrl } from "./resolve-public-media-url";

/**
 * First visual homepage slice: 1 lead + 2 support stories.
 * Temporary until an editorial Homepage Builder exists.
 */
export const PUBLIC_HOMEPAGE_LEAD_SLICE_SIZE = 3;

export { PUBLIC_HOMEPAGE_FEATURED_LIMIT };

/**
 * Bounded candidate window for the temporary recency placement:
 * ATF (3) + featured (5). Do not load all published content.
 */
export const PUBLIC_HOMEPAGE_TEMPORARY_STORY_QUERY_LIMIT =
  PUBLIC_HOMEPAGE_LEAD_SLICE_SIZE + PUBLIC_HOMEPAGE_FEATURED_LIMIT;

export type PublicHomepageCategory = {
  name: string;
  slug: string;
};

export type PublicHomepageStory = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  publishedAt: Date;
  primaryCategory: PublicHomepageCategory | null;
  hero: PublicArticleHeroMedia | null;
};

export type PublicHomepage = {
  lead: PublicHomepageStory | null;
  supports: PublicHomepageStory[];
  conversation: PublicHomepageConversationItem[];
  featured: PublicHomepageStory[];
  /**
   * No public video content type, provider URL, duration, or homepage video
   * media contract exists. Frontend must not render a Video module.
   * See HOMEPAGE_VIDEO_DATA_SOURCE_NOT_YET_AVAILABLE.
   */
  video: null;
  /**
   * MEDIA_ROLE.GALLERY is an article attachment role, not a gallery story.
   * Frontend must not render a Foto Galeri module.
   * See HOMEPAGE_GALLERY_DATA_SOURCE_NOT_YET_AVAILABLE.
   */
  galleries: readonly [];
};

const EMPTY_HOMEPAGE_VIDEO: null = null;
const EMPTY_HOMEPAGE_GALLERIES: readonly [] = [];

type HomepageCandidate = {
  id: string;
  slug: string;
  publishedVersionId: string;
  publishedAt: Date;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
};

/**
 * Temporary public homepage placement used when no published Homepage Builder
 * composition exists, and as deterministic fallback for empty/unavailable slots.
 *
 * HERO imagery is attached after ranking. Missing HERO does not skip a newer
 * published article in favor of an older one with photography.
 *
 * Featured uses the same recency ranking after excluding lead/support IDs.
 * Recency is not editorial curation.
 */
export function selectTemporaryHomepageLeadSlice<T>(
  candidates: readonly T[],
): { lead: T | null; supports: T[] } {
  const bounded = candidates.slice(0, PUBLIC_HOMEPAGE_LEAD_SLICE_SIZE);
  const [lead = null, ...supports] = bounded;
  return { lead, supports };
}

export async function getPublicHomepage(
  options: PublicArticleReadOptions = {},
): Promise<PublicHomepage> {
  const db = getDb();
  const candidateQuery = db
    .select({
      id: contentItems.id,
      slug: contentItems.slug,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      publishedAt: contentItems.publishedAt,
      deletedAt: contentItems.deletedAt,
      title: contentVersions.title,
      subtitle: contentVersions.subtitle,
      excerpt: contentVersions.excerpt,
    })
    .from(contentItems)
    .innerJoin(
      contentVersions,
      and(
        eq(contentVersions.id, contentItems.publishedVersionId),
        eq(contentVersions.contentItemId, contentItems.id),
      ),
    )
    .where(
      and(
        isNull(contentItems.deletedAt),
        eq(contentItems.publicationStatus, PUBLICATION_STATUS.PUBLISHED),
      ),
    )
    .orderBy(desc(contentItems.publishedAt), desc(contentItems.id))
    .limit(PUBLIC_HOMEPAGE_TEMPORARY_STORY_QUERY_LIMIT);

  const [candidateRows, conversation] = await Promise.all([
    candidateQuery,
    getPublicHomepageConversation(options),
  ]);

  const eligible: HomepageCandidate[] = [];
  for (const row of candidateRows) {
    const publishedVersionId = publicPublishedVersionId(row);
    if (!publishedVersionId || row.publishedAt === null) {
      continue;
    }
    eligible.push({
      id: row.id,
      slug: row.slug,
      publishedVersionId,
      publishedAt: row.publishedAt,
      title: row.title,
      subtitle: row.subtitle,
      excerpt: row.excerpt,
    });
  }

  const editorialMap = await loadPublishedHomepageSlotMap();
  const editorialSlots = editorialMap ?? emptyHomepageSlotMap();

  const editorialIds = new Set(
    Object.values(editorialSlots).filter((id): id is string => id !== null),
  );
  const candidateIds = new Set(eligible.map((candidate) => candidate.id));
  const missingEditorialIds = [...editorialIds].filter((id) => !candidateIds.has(id));

  let allCandidates = eligible;
  if (missingEditorialIds.length > 0) {
    const extraRows = await db
      .select({
        id: contentItems.id,
        slug: contentItems.slug,
        publicationStatus: contentItems.publicationStatus,
        publishedVersionId: contentItems.publishedVersionId,
        publishedAt: contentItems.publishedAt,
        deletedAt: contentItems.deletedAt,
        title: contentVersions.title,
        subtitle: contentVersions.subtitle,
        excerpt: contentVersions.excerpt,
      })
      .from(contentItems)
      .innerJoin(
        contentVersions,
        and(
          eq(contentVersions.id, contentItems.publishedVersionId),
          eq(contentVersions.contentItemId, contentItems.id),
        ),
      )
      .where(
        and(
          inArray(contentItems.id, missingEditorialIds),
          isNull(contentItems.deletedAt),
          eq(contentItems.publicationStatus, PUBLICATION_STATUS.PUBLISHED),
        ),
      );

    const extras: HomepageCandidate[] = [];
    for (const row of extraRows) {
      const publishedVersionId = publicPublishedVersionId(row);
      if (!publishedVersionId || row.publishedAt === null) {
        continue;
      }
      extras.push({
        id: row.id,
        slug: row.slug,
        publishedVersionId,
        publishedAt: row.publishedAt,
        title: row.title,
        subtitle: row.subtitle,
        excerpt: row.excerpt,
      });
    }
    allCandidates = [...eligible, ...extras];
  }

  const placement =
    editorialMap === null
      ? (() => {
          const { lead, supports } = selectTemporaryHomepageLeadSlice(eligible);
          const atfIds = new Set(
            [lead, ...supports]
              .filter((candidate): candidate is HomepageCandidate => candidate !== null)
              .map((candidate) => candidate.id),
          );
          return {
            lead,
            supports,
            featured: selectTemporaryHomepageFeatured(eligible, atfIds),
          };
        })()
      : resolvePublicHomepagePlacements(
          editorialSlots,
          allCandidates,
          PUBLIC_HOMEPAGE_FEATURED_LIMIT,
        );

  const leadCandidate = placement.lead;
  const supportCandidates = placement.supports;
  const featuredCandidates = placement.featured;
  const selected = [
    leadCandidate,
    ...supportCandidates,
    ...featuredCandidates,
  ].filter((candidate): candidate is HomepageCandidate => candidate !== null);
  if (selected.length === 0) {
    return {
      lead: null,
      supports: [],
      conversation,
      featured: [],
      video: EMPTY_HOMEPAGE_VIDEO,
      galleries: EMPTY_HOMEPAGE_GALLERIES,
    };
  }

  const versionIds = selected.map((candidate) => candidate.publishedVersionId);
  const [categoryRows, heroRows] = await Promise.all([
    db
      .select({
        contentVersionId: contentVersionCategories.contentVersionId,
        name: categories.name,
        slug: categories.slug,
      })
      .from(contentVersionCategories)
      .innerJoin(
        categories,
        eq(categories.id, contentVersionCategories.categoryId),
      )
      .where(
        and(
          inArray(contentVersionCategories.contentVersionId, versionIds),
          eq(contentVersionCategories.isPrimary, true),
        ),
      ),
    db
      .select({
        contentVersionId: contentVersionMedia.contentVersionId,
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
          inArray(contentVersionMedia.contentVersionId, versionIds),
          eq(contentVersionMedia.role, MEDIA_ROLE.HERO),
          eq(media.mediaType, MEDIA_TYPE.IMAGE),
        ),
      ),
  ]);

  const primaryCategoryByVersion = new Map<string, PublicHomepageCategory>();
  for (const row of categoryRows) {
    if (!primaryCategoryByVersion.has(row.contentVersionId)) {
      primaryCategoryByVersion.set(row.contentVersionId, {
        name: row.name,
        slug: row.slug,
      });
    }
  }

  const heroByVersion = new Map<string, PublicArticleHeroMedia>();
  for (const row of heroRows) {
    const url = resolvePublicMediaUrl(options.mediaPublicBaseUrl, row.storageKey);
    if (!url) {
      continue;
    }
    heroByVersion.set(row.contentVersionId, {
      url,
      width: row.width,
      height: row.height,
      altText: row.altText,
      credit: row.credit,
    });
  }

  function toStory(candidate: HomepageCandidate): PublicHomepageStory {
    return {
      id: candidate.id,
      slug: candidate.slug,
      title: candidate.title,
      subtitle: candidate.subtitle,
      excerpt: candidate.excerpt,
      publishedAt: candidate.publishedAt,
      primaryCategory:
        primaryCategoryByVersion.get(candidate.publishedVersionId) ?? null,
      hero: heroByVersion.get(candidate.publishedVersionId) ?? null,
    };
  }

  return {
    lead: leadCandidate ? toStory(leadCandidate) : null,
    supports: supportCandidates.map(toStory),
    conversation,
    featured: featuredCandidates.map(toStory),
    video: EMPTY_HOMEPAGE_VIDEO,
    galleries: EMPTY_HOMEPAGE_GALLERIES,
  };
}
