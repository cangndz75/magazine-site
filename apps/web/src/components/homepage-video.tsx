import type { PublicEditorialVideoProjection } from "@magazine/domain";
import { ANALYTICS_PLACEMENT } from "@magazine/domain/analytics-client";
import { AnalyticsVideoImpression } from "@/components/analytics/analytics-video-impression";
import { trustedPublicArticleVideos } from "@/lib/public-article-video";

type HomepageVideoProps = {
  video: PublicEditorialVideoProjection;
  homepageVersionId?: string | null;
  analyticsContext?: string;
};

export function HomepageVideo({
  video,
  homepageVersionId,
  analyticsContext,
}: HomepageVideoProps) {
  const trusted = trustedPublicArticleVideos([video])[0];
  if (!trusted) {
    return null;
  }

  const iframeTitle = `${trusted.title} (${trusted.providerLabel})`;
  const captionId = trusted.caption
    ? `homepage-video-caption-${trusted.provider}-${trusted.videoId}`
    : undefined;

  const frame = (
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
  );

  return (
    <section className="homepage-video" aria-label="Video">
      <h2 className="homepage-video__title">Video</h2>
      {video.videoAssetId && homepageVersionId && analyticsContext ? (
        <AnalyticsVideoImpression
          videoAssetId={video.videoAssetId}
          placement={ANALYTICS_PLACEMENT.HOMEPAGE_VIDEO}
          homepageVersionId={homepageVersionId}
          analyticsContext={analyticsContext}
        >
          {frame}
        </AnalyticsVideoImpression>
      ) : (
        frame
      )}
    </section>
  );
}
