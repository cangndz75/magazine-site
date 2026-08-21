import Link from "next/link";
import type { PublicEntityRelatedStoryCard } from "@magazine/db/entities";
import { formatPublicationDay } from "@/lib/format-publication-date";

type PublicEntityTimelineProps = {
  stories: PublicEntityRelatedStoryCard[];
};

export function PublicEntityTimeline({ stories }: PublicEntityTimelineProps) {
  if (stories.length === 0) {
    return null;
  }

  return (
    <section className="public-entity-timeline" aria-label="Haber zaman çizelgesi">
      <h2 className="public-entity-timeline__title">Zaman çizelgesi</h2>
      <ol className="public-entity-timeline__list">
        {stories.map((story) => (
          <li key={`${story.contentItemId}:${story.publishedVersionId}`} className="public-entity-timeline__item">
            <time
              className="public-entity-timeline__date"
              dateTime={story.publishedAt.toISOString()}
            >
              {formatPublicationDay(story.publishedAt)}
            </time>
            <div className="public-entity-timeline__content">
              {story.primaryCategory ? (
                <span className="public-entity-timeline__category">
                  {story.primaryCategory.name}
                </span>
              ) : null}
              <Link href={`/${story.slug}`} className="public-entity-timeline__link">
                {story.title}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
