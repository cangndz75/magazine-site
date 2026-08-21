import Link from "next/link";
import type { PublicEntityRelatedStoryCard } from "@magazine/db/entities";
import { HomepageStoryImage } from "@/components/homepage-story-image";
import { formatPublicationDate } from "@/lib/format-publication-date";

type PublicEntityRelatedStoryProps = {
  story: PublicEntityRelatedStoryCard;
};

export function PublicEntityRelatedStory({ story }: PublicEntityRelatedStoryProps) {
  const href = `/${story.slug}`;

  return (
    <article className="public-entity-related-story">
      <Link href={href} className="public-entity-related-story__link">
        {story.hero ? (
          <div className="public-entity-related-story__figure">
            <HomepageStoryImage
              hero={{ ...story.hero, credit: null }}
              title={story.title}
              className="public-entity-related-story__image"
              sizes="(max-width: 767px) 82vw, (max-width: 1279px) 45vw, 280px"
            />
          </div>
        ) : null}
        <div className="public-entity-related-story__body">
          {story.primaryCategory ? (
            <span className="public-entity-related-story__category">
              {story.primaryCategory.name}
            </span>
          ) : null}
          <h3 className="public-entity-related-story__title">{story.title}</h3>
          <time
            className="public-entity-related-story__date"
            dateTime={story.publishedAt.toISOString()}
          >
            {formatPublicationDate(story.publishedAt)}
          </time>
        </div>
      </Link>
    </article>
  );
}
