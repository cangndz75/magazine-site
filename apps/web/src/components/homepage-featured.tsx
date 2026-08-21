import type { PublicHomepageStory, PublicHomepageAnalyticsPlacement } from "@magazine/db/public";
import { AnalyticsHomepagePlacement } from "@/components/analytics/analytics-homepage-placement";
import { HomepageFeaturedCard } from "@/components/homepage-featured-card";
import { SectionHeader } from "@/components/section-header";

type HomepageFeaturedProps = {
  stories: PublicHomepageStory[];
  placements?: readonly PublicHomepageAnalyticsPlacement[];
};

export function HomepageFeatured({ stories, placements = [] }: HomepageFeaturedProps) {
  if (stories.length === 0) {
    return null;
  }

  const count = Math.min(stories.length, 5);

  return (
    <section className="homepage-featured" aria-labelledby="homepage-featured-heading">
      <SectionHeader title="Öne Çıkanlar" id="homepage-featured-heading" variant="editorial" />
      <div
        className="homepage-featured__grid"
        data-count={count}
        role="list"
      >
        {stories.map((story) => {
          const placement = placements.find(
            (item) =>
              item.contentItemId === story.id &&
              item.placement !== "CONVERSATION",
          );
          const card = <HomepageFeaturedCard story={story} />;
          return (
            <div key={story.id} className="homepage-featured__item" role="listitem">
              {placement?.analyticsContext ? (
                <AnalyticsHomepagePlacement
                  contentItemId={placement.contentItemId}
                  placement={placement.placement}
                  position={placement.position}
                  analyticsContext={placement.analyticsContext}
                >
                  {card}
                </AnalyticsHomepagePlacement>
              ) : (
                card
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
