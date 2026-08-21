/**
 * Public homepage second-viewport read contracts.
 *
 * Featured currently has no editorial placement, featured flag, or Homepage
 * Builder list. Recency after the ATF lead/support IDs is a temporary
 * deterministic fallback only. Replace it when Homepage Builder lands.
 *
 * Homepage video is an explicit Builder-managed editorial video placement.
 * Gallery homepage modules are intentionally unavailable: MEDIA_ROLE.GALLERY is
 * an article media attachment role, not a gallery story type.
 */

export const PUBLIC_HOMEPAGE_FEATURED_LIMIT = 5;

/**
 * Bounded "Son Haberler" (latest) secondary list: always true recency,
 * decoupled from Homepage Builder curation. Does not carry homepage
 * analytics placement identity — there is no authoritative placement slot
 * for it, and placement identities are not invented casually.
 */
export const PUBLIC_HOMEPAGE_LATEST_LIMIT = 6;

export const HOMEPAGE_GALLERY_DATA_SOURCE_NOT_YET_AVAILABLE =
  "HOMEPAGE_GALLERY_DATA_SOURCE_NOT_YET_AVAILABLE" as const;

export type HomepageGalleryDataSourceStatus =
  typeof HOMEPAGE_GALLERY_DATA_SOURCE_NOT_YET_AVAILABLE;

/**
 * Temporary featured placement: keep the incoming order (publishedAt DESC,
 * id DESC) and take the next stories after the current lead/support IDs.
 *
 * Recency is not editorial curation.
 */
export function selectTemporaryHomepageFeatured<T extends { id: string }>(
  candidates: readonly T[],
  excludeIds: ReadonlySet<string>,
): T[] {
  const featured: T[] = [];
  for (const candidate of candidates) {
    if (excludeIds.has(candidate.id)) {
      continue;
    }
    featured.push(candidate);
    if (featured.length === PUBLIC_HOMEPAGE_FEATURED_LIMIT) {
      break;
    }
  }
  return featured;
}

/**
 * Bounded "Son Haberler" slice: same recency ordering as the incoming
 * candidates, after excluding every content item already displayed in the
 * lead, support, or featured placements (whichever placement strategy is
 * active). Never displays a duplicate story.
 */
export function selectTemporaryHomepageLatest<T extends { id: string }>(
  candidates: readonly T[],
  excludeIds: ReadonlySet<string>,
): T[] {
  const latest: T[] = [];
  for (const candidate of candidates) {
    if (excludeIds.has(candidate.id)) {
      continue;
    }
    latest.push(candidate);
    if (latest.length === PUBLIC_HOMEPAGE_LATEST_LIMIT) {
      break;
    }
  }
  return latest;
}
