import Link from "next/link";
import type { PublicHomepageStory } from "@magazine/db/public";
import { HomepageStoryImage } from "@/components/homepage-story-image";
import { SectionHeader } from "@/components/section-header";
import { formatPublicationDate } from "@/lib/format-publication-date";

type HomepageLatestProps = {
  stories: PublicHomepageStory[];
};

/**
 * "Son Haberler": bounded, always-recency secondary list (see
 * PUBLIC_HOMEPAGE_LATEST_LIMIT / selectTemporaryHomepageLatest). Deliberately
 * not wrapped in homepage analytics placement instrumentation: there is no
 * authoritative HOMEPAGE_SLOT placement for this list, and placement
 * identities are not invented casually (see AGENTS.md analytics rules).
 */
export function HomepageLatest({ stories }: HomepageLatestProps) {
  if (stories.length === 0) {
    return null;
  }

  return (
    <section className="homepage-latest" aria-labelledby="homepage-latest-heading">
      <SectionHeader title="Son Haberler" id="homepage-latest-heading" variant="editorial" />
      <ol className="homepage-latest__list">
        {stories.map((story) => (
          <li key={story.id} className="homepage-latest__item">
            <Link href={`/${story.slug}`} className="homepage-latest__link">
              {story.hero ? (
                <div className="homepage-latest__figure">
                  <HomepageStoryImage
                    hero={story.hero}
                    title={story.title}
                    className="homepage-latest__image"
                    sizes="(min-width: 1024px) 140px, 96px"
                  />
                </div>
              ) : null}
              <div className="homepage-latest__body">
                {story.primaryCategory ? (
                  <span className="homepage-story__category">
                    {story.primaryCategory.name}
                  </span>
                ) : null}
                <h3 className="homepage-latest__title">{story.title}</h3>
                <time className="homepage-latest__time" dateTime={story.publishedAt.toISOString()}>
                  {formatPublicationDate(story.publishedAt)}
                </time>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
