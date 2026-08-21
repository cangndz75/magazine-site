"use client";

import { useState } from "react";
import Image from "next/image";

type HomepageVideoPlayerProps = {
  embedUrl: string;
  iframeTitle: string;
  playLabel: string;
  poster: {
    url: string;
    width: number | null;
    height: number | null;
    altText: string | null;
  } | null;
  duration: string | null;
  unoptimized: boolean;
};

/**
 * Client-only play affordance: renders a poster + play button and defers
 * mounting the provider iframe until the visitor explicitly clicks play.
 * No autoplay. Analytics VIDEO_IMPRESSION is attached by the server-rendered
 * parent (HomepageVideo) around this component, so it fires regardless of
 * whether the visitor has pressed play yet.
 */
export function HomepageVideoPlayer({
  embedUrl,
  iframeTitle,
  playLabel,
  poster,
  duration,
  unoptimized,
}: HomepageVideoPlayerProps) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="homepage-video__frame">
        <iframe
          className="homepage-video__iframe"
          src={embedUrl}
          title={iframeTitle}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="homepage-video__poster"
      onClick={() => setPlaying(true)}
      aria-label={playLabel}
    >
      {poster ? (
        <Image
          src={poster.url}
          alt={poster.altText ?? iframeTitle}
          width={poster.width ?? 960}
          height={poster.height ?? 540}
          sizes="(min-width: 1024px) 420px, 100vw"
          className="homepage-video__poster-image"
          unoptimized={unoptimized}
        />
      ) : (
        <span className="homepage-video__poster-fallback" aria-hidden="true" />
      )}
      <span className="homepage-video__play" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      {duration ? <span className="homepage-video__duration">{duration}</span> : null}
    </button>
  );
}
