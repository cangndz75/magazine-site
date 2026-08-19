import type { PublicHomepageStory } from "@magazine/db/public";
import { HomepageFeaturedCard } from "@/components/homepage-featured-card";
import { SectionHeader } from "@/components/section-header";

type HomepageFeaturedProps = {
  stories: PublicHomepageStory[];
};

export function HomepageFeatured({ stories }: HomepageFeaturedProps) {
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
        {stories.map((story) => (
          <div key={story.id} className="homepage-featured__item" role="listitem">
            <HomepageFeaturedCard story={story} />
          </div>
        ))}
      </div>
    </section>
  );
}
