/**
 * SEO Command Center product policy.
 *
 * These bounds are editorial recommendations, not ranking guarantees and not
 * publish blockers. Findings remain authoritative; the numeric score is a
 * presentation helper derived from findings.
 *
 * Sources:
 * - Public article SEO already emits title, excerpt/subtitle description,
 *   generated canonical (SITE_URL + slug), OG/Twitter, and NewsArticle JSON-LD.
 * - Google's documented title/snippet display windows are used as editorial
 *   warning thresholds, not as technical errors.
 * - HERO dimension guidance follows Open Graph large-image practice and the
 *   existing ARTICLE_HERO rendition preference (LARGE, max edge 1280).
 */

export const SEO_FINDING_SEVERITY = {
  ERROR: "ERROR",
  WARNING: "WARNING",
  INFO: "INFO",
} as const;

export type SeoFindingSeverity =
  (typeof SEO_FINDING_SEVERITY)[keyof typeof SEO_FINDING_SEVERITY];

export const SEO_FINDING_KIND = {
  TECHNICAL: "TECHNICAL",
  EDITORIAL: "EDITORIAL",
} as const;

export type SeoFindingKind =
  (typeof SEO_FINDING_KIND)[keyof typeof SEO_FINDING_KIND];

export const SEO_TITLE_POLICY = {
  MIN_CHARS: 8,
  MAX_CHARS: 70,
} as const;

export const SEO_META_DESCRIPTION_POLICY = {
  MIN_CHARS: 50,
  MAX_CHARS: 160,
} as const;

/**
 * Social/news HERO suitability. Missing dimensions is informational;
 * falling below these sizes is an editorial warning, not a publish block.
 * Discover large-image guidance uses the same 1200px minimum width and never
 * assumes CDN/upscaling will enlarge a smaller source.
 */
export const SEO_HERO_POLICY = {
  RECOMMENDED_MIN_WIDTH: 1200,
  RECOMMENDED_MIN_HEIGHT: 630,
} as const;

/**
 * Discover readiness is a technical/editorial checklist. It is not a
 * ranking, eligibility, E-E-A-T, crawl, or traffic guarantee.
 */
export const SEO_DISCOVER_POLICY = {
  MIN_HERO_WIDTH: SEO_HERO_POLICY.RECOMMENDED_MIN_WIDTH,
  PLACEMENT_NOT_GUARANTEED: true,
} as const;

/**
 * Score is presentation-only. Any ERROR forces 0 so a green score cannot
 * hide a technical blocker. WARNINGs subtract a fixed penalty. INFO does
 * not change the score.
 */
export const SEO_SCORE_POLICY = {
  MAX: 100,
  MIN: 0,
  ERROR_FORCES_ZERO: true,
  WARNING_PENALTY: 8,
  INFO_PENALTY: 0,
} as const;

/**
 * Current slug remains on ContentItem. Historical slugs permanently redirect
 * to the trusted current public slug in one hop. Occupancy is fail-closed:
 * another item cannot take a historical slug as its current slug.
 */
export const SEO_SLUG_GOVERNANCE = {
  REDIRECT_HISTORY_IMPLEMENTED: true,
} as const;
