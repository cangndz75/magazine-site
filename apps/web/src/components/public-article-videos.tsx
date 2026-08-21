import type { PublicEditorialVideoProjection } from "@magazine/domain";
import { ANALYTICS_PLACEMENT } from "@magazine/domain/analytics-client";
import { AnalyticsVideoImpression } from "@/components/analytics/analytics-video-impression";
import { trustedPublicArticleVideos } from "../lib/public-article-video";

type PublicArticleVideosProps = {
  videos: readonly PublicEditorialVideoProjection[];
  contentItemId?: string;
  analyticsContext?: string;
};

export function PublicArticleVideos({
  videos,
  contentItemId,
  analyticsContext,
}: PublicArticleVideosProps) {
  const trusted = videos.flatMap((video) => {
    const playback = trustedPublicArticleVideos([video])[0];
    if (!playback) {
      return [];
    }
    return [{ playback, videoAssetId: video.videoAssetId }];
  });
  if (trusted.length === 0) {
    return null;
  }

  return (
    <section className="article-videos" aria-label="Videolar">
      <h2 className="article-videos__title">Videolar</h2>
      <ol className="article-videos__list">
        {trusted.map(({ playback, videoAssetId }) => {
          const iframeTitle = `${playback.title} (${playback.providerLabel})`;
          const captionId = playback.caption
            ? `article-video-caption-${playback.provider}-${playback.videoId}`
            : undefined;
          const frame = (
            <figure className="article-video__figure" aria-labelledby={captionId}>
              <div className="article-video__frame">
                <iframe
                  className="article-video__iframe"
                  src={playback.embedUrl}
                  title={iframeTitle}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
              <figcaption className="article-video__meta">
                <p className="article-video__provider">{playback.providerLabel}</p>
                {playback.caption ? (
                  <p id={captionId} className="article-video__caption">
                    {playback.caption}
                  </p>
                ) : (
                  <p className="article-video__caption">{playback.title}</p>
                )}
              </figcaption>
            </figure>
          );

          return (
            <li
              key={`${playback.provider}:${playback.videoId}`}
              className="article-video"
            >
              {videoAssetId && contentItemId && analyticsContext ? (
                <AnalyticsVideoImpression
                  videoAssetId={videoAssetId}
                  placement={ANALYTICS_PLACEMENT.ARTICLE_VIDEO}
                  contentItemId={contentItemId}
                  analyticsContext={analyticsContext}
                >
                  {frame}
                </AnalyticsVideoImpression>
              ) : (
                frame
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
