import Link from "next/link";
import type { PublicHomepageStory, PublicHomepageAnalyticsPlacement } from "@magazine/db/public";
import { ANALYTICS_PLACEMENT } from "@magazine/domain/analytics-client";
import { AnalyticsHomepagePlacement } from "@/components/analytics/analytics-homepage-placement";
import { findHomepagePlacement } from "@/lib/analytics/placements";

type HomepageBreakingStripProps = {
  story: PublicHomepageStory;
  placements: readonly PublicHomepageAnalyticsPlacement[];
};

/**
 * Thin "SON DAKİKA" strip under the masthead. Sourced from the same
 * editorially-authoritative lead story shown in the hero (Homepage Builder
 * LEAD slot, or the deterministic recency fallback) — never a fabricated or
 * separately-persisted ticker. Reuses the LEAD placement identity so the
 * shared impression-dedup key does not create a second counted impression
 * for the same content item (see AnalyticsHomepagePlacement / impression.ts).
 */
export function HomepageBreakingStrip({ story, placements }: HomepageBreakingStripProps) {
  const placement = findHomepagePlacement(placements, {
    contentItemId: story.id,
    placement: ANALYTICS_PLACEMENT.LEAD,
  });

  const link = (
    <Link href={`/${story.slug}`} className="homepage-breaking-strip__link">
      <span className="homepage-breaking-strip__badge">Son Dakika</span>
      <span className="homepage-breaking-strip__headline">{story.title}</span>
    </Link>
  );

  return (
    <div className="homepage-breaking-strip" role="note" aria-label="Son dakika">
      {placement?.analyticsContext ? (
        <AnalyticsHomepagePlacement
          contentItemId={placement.contentItemId}
          placement={placement.placement}
          position={placement.position}
          analyticsContext={placement.analyticsContext}
        >
          {link}
        </AnalyticsHomepagePlacement>
      ) : (
        link
      )}
    </div>
  );
}
