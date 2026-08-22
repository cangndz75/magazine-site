import { SectionHeader } from "@/components/section-header";
import { HomepagePreviewStill } from "@/components/homepage-preview-still";
import { HOMEPAGE_PREVIEW_VIDEOS } from "@/lib/homepage-preview-modules";

function PlayMark() {
  return (
    <span className="homepage-video-gallery__play" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

export function HomepageVideoGallery() {
  const featured = HOMEPAGE_PREVIEW_VIDEOS.find((item) => item.featured);
  const rest = HOMEPAGE_PREVIEW_VIDEOS.filter((item) => !item.featured);

  if (!featured) {
    return null;
  }

  return (
    <section
      className="homepage-video-gallery"
      aria-labelledby="homepage-video-gallery-heading"
    >
      <SectionHeader
        title="Video Galeri"
        id="homepage-video-gallery-heading"
        variant="editorial"
      />
      <div className="homepage-video-gallery__layout">
        <article className="homepage-video-gallery__featured">
          <div className="homepage-video-gallery__featured-figure">
            <HomepagePreviewStill
              src={featured.imageSrc}
              alt={featured.title}
              className="homepage-video-gallery__image"
              sizes="(min-width: 1280px) 36vw, (min-width: 768px) 50vw, 100vw"
              objectPosition={featured.objectPosition}
            />
            <PlayMark />
            <span className="homepage-video-gallery__duration">{featured.duration}</span>
          </div>
          <div className="homepage-video-gallery__body">
            <span className="homepage-story__category">{featured.category}</span>
            <h3 className="homepage-video-gallery__title">{featured.title}</h3>
          </div>
        </article>

        <ul className="homepage-video-gallery__list">
          {rest.map((item) => (
            <li key={item.key}>
              <article className="homepage-video-gallery__item">
                <div className="homepage-video-gallery__thumb">
                  <HomepagePreviewStill
                    src={item.imageSrc}
                    alt=""
                    className="homepage-video-gallery__image"
                    sizes="140px"
                    objectPosition={item.objectPosition}
                  />
                  <PlayMark />
                </div>
                <div className="homepage-video-gallery__item-body">
                  <span className="homepage-story__category">{item.category}</span>
                  <h3 className="homepage-video-gallery__item-title">{item.title}</h3>
                  <span className="homepage-video-gallery__item-duration">
                    {item.duration}
                  </span>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
