import Link from "next/link";
import type { PublicHomepageStory } from "@magazine/db/public";
import { HomepageStoryImage } from "@/components/homepage-story-image";

type HomepageFeaturedCardProps = {
  story: PublicHomepageStory;
};

export function HomepageFeaturedCard({ story }: HomepageFeaturedCardProps) {
  const href = `/${story.slug}`;

  if (story.hero) {
    return (
      <article className="homepage-featured-card">
        <Link href={href} className="homepage-featured-card__link" aria-label={story.title}>
          <div className="homepage-featured-card__figure">
            <HomepageStoryImage
              hero={story.hero}
              title={story.title}
              className="homepage-featured-card__image"
              sizes="(max-width: 767px) 82vw, (max-width: 1279px) 45vw, 240px"
            />
          </div>
          <div className="homepage-featured-card__body">
            {story.primaryCategory ? (
              <span className="homepage-featured-card__category">{story.primaryCategory.name}</span>
            ) : null}
            <h3 className="homepage-featured-card__title">{story.title}</h3>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="homepage-featured-card homepage-featured-card--text">
      <Link href={href} className="homepage-featured-card__text-link" aria-label={story.title}>
        {story.primaryCategory ? (
          <span className="homepage-featured-card__category">{story.primaryCategory.name}</span>
        ) : null}
        <h3 className="homepage-featured-card__title">{story.title}</h3>
      </Link>
    </article>
  );
}
