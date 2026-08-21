"use client";

import { useId, useState } from "react";
import type { PublicArticleGalleryItem } from "@magazine/db/public";
import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_GALLERY_NAVIGATION_METHOD,
  galleryAnalyticsEmissions,
} from "@magazine/domain/analytics-client";
import { publicAnalytics } from "@/lib/analytics/track";
import {
  currentGalleryIndex,
  galleryItemsIdentity,
  stepGalleryIndex,
} from "./public-article-gallery-state";

type PublicArticleGalleryProps = {
  items: PublicArticleGalleryItem[];
  contentItemId: string;
  analyticsContext: string;
};

export function PublicArticleGallery({
  items,
  contentItemId,
  analyticsContext,
}: PublicArticleGalleryProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <PublicArticleGalleryViewer
      key={galleryItemsIdentity(items)}
      items={items}
      contentItemId={contentItemId}
      analyticsContext={analyticsContext}
    />
  );
}

function emitGalleryAnalytics(
  contentItemId: string,
  analyticsContext: string,
  emissions: ReturnType<typeof galleryAnalyticsEmissions>["emissions"],
) {
  for (const emission of emissions) {
    if (emission.eventName === ANALYTICS_EVENT_NAME.GALLERY_OPEN) {
      publicAnalytics.trackGalleryOpen({
        contentItemId,
        mediaId: emission.mediaId,
        galleryPosition: emission.galleryPosition,
        analyticsContext,
      });
      continue;
    }
    if (emission.eventName === ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE) {
      publicAnalytics.trackGalleryNavigate({
        contentItemId,
        mediaId: emission.mediaId,
        galleryPosition: emission.galleryPosition,
        navigationMethod: emission.navigationMethod,
        analyticsContext,
      });
      continue;
    }
    publicAnalytics.trackGalleryImageView({
      contentItemId,
      mediaId: emission.mediaId,
      galleryPosition: emission.galleryPosition,
      analyticsContext,
    });
  }
}

function PublicArticleGalleryViewer({
  items,
  contentItemId,
  analyticsContext,
}: {
  items: PublicArticleGalleryItem[];
  contentItemId: string;
  analyticsContext: string;
}) {
  const labelId = useId();
  const captionId = useId();
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [opened, setOpened] = useState(false);
  const total = items.length;
  const currentIndex = currentGalleryIndex(index, total);
  const current = items[currentIndex] ?? null;

  if (!current) {
    return null;
  }

  function applyUserNavigation(
    nextIndex: number,
    method: (typeof ANALYTICS_GALLERY_NAVIGATION_METHOD)[keyof typeof ANALYTICS_GALLERY_NAVIGATION_METHOD],
  ) {
    const result = galleryAnalyticsEmissions({
      opened,
      items,
      action: {
        method,
        fromIndex: currentIndex,
        toIndex: nextIndex,
      },
    });
    emitGalleryAnalytics(contentItemId, analyticsContext, result.emissions);
    setOpened(result.opened);
    setIndex(result.index);
  }

  function go(delta: number) {
    applyUserNavigation(
      stepGalleryIndex(currentIndex, total, delta),
      delta < 0
        ? ANALYTICS_GALLERY_NAVIGATION_METHOD.PREV
        : ANALYTICS_GALLERY_NAVIGATION_METHOD.NEXT,
    );
  }

  const currentFailed = failed[current.mediaId] === true;
  const figureLabel = current.caption
    ? `${captionId}-${current.mediaId}`
    : undefined;

  return (
    <section
      className="article-gallery"
      aria-labelledby={labelId}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          applyUserNavigation(
            stepGalleryIndex(currentIndex, total, -1),
            ANALYTICS_GALLERY_NAVIGATION_METHOD.KEYBOARD,
          );
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          applyUserNavigation(
            stepGalleryIndex(currentIndex, total, 1),
            ANALYTICS_GALLERY_NAVIGATION_METHOD.KEYBOARD,
          );
        }
      }}
    >
      <h2 id={labelId} className="article-gallery__title">
        Galeri
      </h2>
      <figure className="article-gallery__stage" aria-labelledby={figureLabel}>
        <div className="article-gallery__frame">
          {currentFailed ? (
            <p className="article-gallery__missing">Görsel yüklenemedi</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={current.mediaId}
              src={current.url}
              srcSet={current.srcSet ?? undefined}
              sizes={current.sizes ?? undefined}
              alt={current.altText ?? ""}
              width={current.width ?? undefined}
              height={current.height ?? undefined}
              className="article-gallery__image"
              loading={currentIndex === 0 ? "eager" : "lazy"}
              decoding="async"
              onError={() =>
                setFailed((currentFailedMap) => ({
                  ...currentFailedMap,
                  [current.mediaId]: true,
                }))
              }
            />
          )}
        </div>
        <figcaption className="article-gallery__meta">
          {current.caption ? (
            <p id={`${captionId}-${current.mediaId}`} className="article-gallery__caption">
              {current.caption}
            </p>
          ) : null}
          {current.credit ? (
            <p className="article-gallery__credit">{current.credit}</p>
          ) : null}
          <p className="article-gallery__position">
            {currentIndex + 1} / {total}
          </p>
        </figcaption>
      </figure>
      <div className="article-gallery__controls">
        <button
          type="button"
          className="article-gallery__nav"
          onClick={() => go(-1)}
          aria-label="Önceki görsel"
        >
          Önceki
        </button>
        <button
          type="button"
          className="article-gallery__nav"
          onClick={() => go(1)}
          aria-label="Sonraki görsel"
        >
          Sonraki
        </button>
      </div>
      {total > 1 ? (
        <ul className="article-gallery__strip" aria-label="Galeri küçük resimleri">
          {items.map((item, itemIndex) => {
            const selected = itemIndex === currentIndex;
            const thumbFailed = failed[item.mediaId] === true;
            return (
              <li key={item.mediaId}>
                <button
                  type="button"
                  className={
                    selected
                      ? "article-gallery__thumb article-gallery__thumb--selected"
                      : "article-gallery__thumb"
                  }
                  aria-current={selected ? "true" : undefined}
                  aria-label={`Görsel ${itemIndex + 1}${item.caption ? `: ${item.caption}` : ""}`}
                  onClick={() =>
                    applyUserNavigation(
                      itemIndex,
                      ANALYTICS_GALLERY_NAVIGATION_METHOD.THUMB,
                    )
                  }
                >
                  {thumbFailed ? (
                    <span className="article-gallery__thumb-missing">Yok</span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbUrl ?? item.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
