import Link from "next/link";
import type { PublicHomepageStory } from "@magazine/db/public";
import { HomepageStoryImage } from "@/components/homepage-story-image";

type HomepageSupportStoryProps = {
  story: PublicHomepageStory;
};

export function HomepageSupportStory({ story }: HomepageSupportStoryProps) {
  const href = `/${story.slug}`;

  if (story.hero) {
    return (
      <article className="homepage-support-story">
        <Link href={href} className="homepage-support-story__link" aria-label={story.title}>
          <div className="homepage-support-story__figure">
            <HomepageStoryImage
              hero={story.hero}
              title={story.title}
              className="homepage-support-story__image"
              sizes="(min-width: 1280px) 430px, (min-width: 768px) 45vw, 100vw"
            />
            <div className="homepage-support-story__gradient" aria-hidden="true" />
            <div className="homepage-support-story__overlay">
              {story.primaryCategory ? (
                <span className="homepage-story__category homepage-story__category--overlay">
                  {story.primaryCategory.name}
                </span>
              ) : null}
              <h3 className="homepage-support-story__title">{story.title}</h3>
            </div>
          </div>
          <div className="homepage-support-story__below">
            {story.primaryCategory ? (
              <span className="homepage-story__category">{story.primaryCategory.name}</span>
            ) : null}
            <h3 className="homepage-support-story__title-below">{story.title}</h3>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="homepage-support-story homepage-support-story--text">
      <Link href={href} className="homepage-support-story__text-link" aria-label={story.title}>
        {story.primaryCategory ? (
          <span className="homepage-story__category">{story.primaryCategory.name}</span>
        ) : null}
        <h3 className="homepage-support-story__title-below">{story.title}</h3>
      </Link>
    </article>
  );
}
