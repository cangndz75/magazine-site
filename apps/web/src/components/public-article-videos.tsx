import type { PublicEditorialVideoProjection } from "@magazine/domain";
import { trustedPublicArticleVideos } from "../lib/public-article-video";

type PublicArticleVideosProps = {
  videos: readonly PublicEditorialVideoProjection[];
};

export function PublicArticleVideos({ videos }: PublicArticleVideosProps) {
  const trusted = trustedPublicArticleVideos(videos);
  if (trusted.length === 0) {
    return null;
  }

  return (
    <section className="article-videos" aria-label="Videolar">
      <h2 className="article-videos__title">Videolar</h2>
      <ol className="article-videos__list">
        {trusted.map((video) => {
          const iframeTitle = `${video.title} (${video.providerLabel})`;
          const captionId = video.caption
            ? `article-video-caption-${video.provider}-${video.videoId}`
            : undefined;

          return (
            <li key={`${video.provider}:${video.videoId}`} className="article-video">
              <figure className="article-video__figure" aria-labelledby={captionId}>
                <div className="article-video__frame">
                  <iframe
                    className="article-video__iframe"
                    src={video.embedUrl}
                    title={iframeTitle}
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                </div>
                <figcaption className="article-video__meta">
                  <p className="article-video__provider">{video.providerLabel}</p>
                  {video.caption ? (
                    <p id={captionId} className="article-video__caption">
                      {video.caption}
                    </p>
                  ) : (
                    <p className="article-video__caption">{video.title}</p>
                  )}
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
