import Link from "next/link";
import type { PublicHomepageGallery } from "@magazine/db/public";
import { HomepageStoryImage } from "@/components/homepage-story-image";
import { SectionHeader } from "@/components/section-header";
import { formatPublicationDate } from "@/lib/format-publication-date";

type HomepagePhotoGalleriesProps = {
  galleries: PublicHomepageGallery[];
};

export function HomepagePhotoGalleries({
  galleries,
}: HomepagePhotoGalleriesProps) {
  if (galleries.length === 0) {
    return null;
  }

  return (
    <section
      className="homepage-photo-galleries"
      aria-labelledby="homepage-photo-galleries-heading"
    >
      <SectionHeader
        title="Foto Galeri"
        id="homepage-photo-galleries-heading"
        variant="editorial"
      />
      <div
        className="homepage-photo-galleries__grid"
        data-count={galleries.length}
      >
        {galleries.map((gallery) => (
          <article key={gallery.slug} className="homepage-photo-gallery-card">
            <Link
              href={`/galeri/${gallery.slug}`}
              className="homepage-photo-gallery-card__link"
            >
              <div className="homepage-photo-gallery-card__figure">
                <HomepageStoryImage
                  hero={gallery.cover}
                  title={gallery.title}
                  className="homepage-photo-gallery-card__image"
                  sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                />
                <span className="homepage-photo-gallery-card__count">
                  {gallery.imageCount} foto
                </span>
              </div>
              <div className="homepage-photo-gallery-card__body">
                {gallery.primaryCategory ? (
                  <span className="homepage-story__category">
                    {gallery.primaryCategory.name}
                  </span>
                ) : null}
                <h3 className="homepage-photo-gallery-card__title">
                  {gallery.title}
                </h3>
                <time
                  className="homepage-photo-gallery-card__time"
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
