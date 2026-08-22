import type { PublicEditorialVideoProjection } from "@magazine/domain";
import { ANALYTICS_PLACEMENT } from "@magazine/domain/analytics-client";
import { AnalyticsVideoImpression } from "@/components/analytics/analytics-video-impression";
import { HomepageVideoPlayer } from "@/components/homepage-video-player";
import { env } from "@/lib/env";
import { trustedPublicArticleVideos } from "@/lib/public-article-video";

type HomepageVideoProps = {
  video: PublicEditorialVideoProjection;
  homepageVersionId?: string | null;
  analyticsContext?: string;
  variant?: "default" | "rail";
};

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function HomepageVideo({
  video,
  homepageVersionId,
  analyticsContext,
  variant = "default",
}: HomepageVideoProps) {
  const trusted = trustedPublicArticleVideos([video])[0];
  if (!trusted) {
    return null;
  }

  const useUnoptimizedImage = env.APP_ENV === "development";
  const iframeTitle = `${trusted.title} (${trusted.providerLabel})`;
  const captionId = trusted.caption
    ? `homepage-video-caption-${trusted.provider}-${trusted.videoId}`
    : undefined;
  const duration = formatDuration(video.durationSeconds);

  const figure = (
    <figure className="homepage-video__figure" aria-labelledby={captionId}>
      <HomepageVideoPlayer
        embedUrl={trusted.embedUrl}
        iframeTitle={iframeTitle}
        playLabel={`${trusted.title} videosunu oynat`}
        poster={
          video.poster
            ? {
                url: video.poster.url,
                width: video.poster.width,
                height: video.poster.height,
                altText: video.poster.altText,
              }
            : null
        }
        duration={duration}
        unoptimized={useUnoptimizedImage}
      />
      <figcaption className="homepage-video__meta">
        <p className="homepage-video__provider">{trusted.providerLabel}</p>
        {trusted.caption ? (
          <p id={captionId} className="homepage-video__caption">
            {trusted.caption}
          </p>
        ) : (
          <p className="homepage-video__caption">{trusted.title}</p>
        )}
      </figcaption>
    </figure>
  );

  const sectionClassName =
    variant === "rail" ? "homepage-video homepage-video--rail" : "homepage-video";

  return (
    <section className={sectionClassName} aria-label="Video">
      <h2 className="homepage-video__title">Video</h2>
      {video.videoAssetId && homepageVersionId && analyticsContext ? (
        <AnalyticsVideoImpression
          videoAssetId={video.videoAssetId}
          placement={ANALYTICS_PLACEMENT.HOMEPAGE_VIDEO}
          homepageVersionId={homepageVersionId}
          analyticsContext={analyticsContext}
        >
          {figure}
        </AnalyticsVideoImpression>
      ) : (
        figure
      )}
    </section>
  );
}
