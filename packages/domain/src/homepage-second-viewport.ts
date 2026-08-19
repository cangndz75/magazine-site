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
