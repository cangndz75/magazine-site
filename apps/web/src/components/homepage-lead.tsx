import Link from "next/link";
import type { PublicHomepageStory } from "@magazine/db/public";
import { HomepageStoryImage } from "@/components/homepage-story-image";

type HomepageLeadProps = {
  story: PublicHomepageStory;
};

function storyDek(story: PublicHomepageStory): string | null {
  return story.subtitle ?? story.excerpt;
}

export function HomepageLead({ story }: HomepageLeadProps) {
  const dek = storyDek(story);
  const href = `/${story.slug}`;

  if (story.hero) {
    return (
      <article className="homepage-lead">
        <Link href={href} className="homepage-lead__link">
          <div className="homepage-lead__figure">
            <HomepageStoryImage
              hero={story.hero}
              title={story.title}
              className="homepage-lead__image"
              sizes="(min-width: 1280px) 820px, (min-width: 768px) 90vw, 100vw"
              priority
            />
            <div className="homepage-lead__gradient" aria-hidden="true" />
            <div className="homepage-lead__overlay">
              {story.primaryCategory ? (
                <span className="homepage-story__category homepage-story__category--overlay">
                  {story.primaryCategory.name}
                </span>
              ) : null}
              <h1 className="homepage-lead__title">{story.title}</h1>
              {dek ? <p className="homepage-lead__dek">{dek}</p> : null}
            </div>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="homepage-lead homepage-lead--text">
      <Link href={href} className="homepage-lead__text-link">
        {story.primaryCategory ? (
          <span className="homepage-story__category">{story.primaryCategory.name}</span>
        ) : null}
        <h1 className="homepage-lead__title homepage-lead__title--text">{story.title}</h1>
        {dek ? <p className="homepage-lead__dek homepage-lead__dek--text">{dek}</p> : null}
      </Link>
    </article>
  );
}
