import Link from "next/link";
import type { PublicHomepageGallery } from "@magazine/db/public";
import { HomepageStoryImage } from "@/components/homepage-story-image";
import { formatPublicationDate } from "@/lib/format-publication-date";

type PublicPhotoGalleryRelatedProps = {
  galleries: readonly PublicHomepageGallery[];
  currentSlug: string;
};

export function PublicPhotoGalleryRelated({
  galleries,
  currentSlug,
}: PublicPhotoGalleryRelatedProps) {
  const related = galleries.filter((gallery) => gallery.slug !== currentSlug).slice(0, 4);
  if (related.length === 0) {
    return null;
  }

  return (
    <section className="photo-gallery-related" aria-labelledby="photo-gallery-related-heading">
      <h2 className="photo-gallery-related__heading" id="photo-gallery-related-heading">
        Diğer Galeriler
      </h2>
      <div className="photo-gallery-related__grid" data-count={related.length}>
        {related.map((gallery) => (
          <article key={gallery.slug} className="photo-gallery-related__card">
            <Link href={`/galeri/${gallery.slug}`} className="photo-gallery-related__link">
              <div className="photo-gallery-related__figure">
                <HomepageStoryImage
                  hero={gallery.cover}
                  title={gallery.title}
                  className="photo-gallery-related__image"
                  sizes="(min-width: 1024px) 240px, 50vw"
                />
                <span className="photo-gallery-related__count">{gallery.imageCount} foto</span>
              </div>
              <div className="photo-gallery-related__body">
                {gallery.primaryCategory ? (
                  <span className="photo-gallery-related__category">
                    {gallery.primaryCategory.name}
                  </span>
                ) : null}
                <h3 className="photo-gallery-related__title">{gallery.title}</h3>
                <time
                  className="photo-gallery-related__time"
                  dateTime={gallery.publishedAt.toISOString()}
                >
                  {formatPublicationDate(gallery.publishedAt)}
                </time>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
