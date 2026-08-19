import type { PublicEditorialVideoProjection } from "@magazine/domain";
import { trustedPublicArticleVideos } from "@/lib/public-article-video";

type HomepageVideoProps = {
  video: PublicEditorialVideoProjection;
};

export function HomepageVideo({ video }: HomepageVideoProps) {
  const trusted = trustedPublicArticleVideos([video])[0];
  if (!trusted) {
    return null;
  }

  const iframeTitle = `${trusted.title} (${trusted.providerLabel})`;
  const captionId = trusted.caption
    ? `homepage-video-caption-${trusted.provider}-${trusted.videoId}`
    : undefined;

  return (
    <section className="homepage-video" aria-label="Video">
      <h2 className="homepage-video__title">Video</h2>
      <figure className="article-video__figure" aria-labelledby={captionId}>
        <div className="article-video__frame">
          <iframe
            className="article-video__iframe"
            src={trusted.embedUrl}
            title={iframeTitle}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
        <figcaption className="article-video__meta">
          <p className="article-video__provider">{trusted.providerLabel}</p>
          {trusted.caption ? (
            <p id={captionId} className="article-video__caption">
              {trusted.caption}
            </p>
          ) : (
            <p className="article-video__caption">{trusted.title}</p>
          )}
        </figcaption>
      </figure>
    </section>
  );
}
