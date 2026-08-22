"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PublicArticleGalleryItem } from "@magazine/db/public";
import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_GALLERY_NAVIGATION_METHOD,
  galleryAnalyticsEmissions,
} from "@magazine/domain/analytics-client";
import { publicAnalytics } from "@/lib/analytics/track";
import {
  buildPhotoGalleryLayout,
  type PhotoGalleryLayoutBlock,
} from "@/lib/public-photo-gallery-layout";
import {
  currentGalleryIndex,
  galleryItemsIdentity,
  stepGalleryIndex,
} from "./public-article-gallery-state";

type PublicPhotoGalleryStoryProps = {
  items: PublicArticleGalleryItem[];
  contentItemId: string;
  analyticsContext: string;
};

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

export function PublicPhotoGalleryStory({
  items,
  contentItemId,
  analyticsContext,
}: PublicPhotoGalleryStoryProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <PublicPhotoGalleryStoryViewer
      key={galleryItemsIdentity(items)}
      items={items}
      contentItemId={contentItemId}
      analyticsContext={analyticsContext}
    />
  );
}

function PublicPhotoGalleryStoryViewer({
  items,
  contentItemId,
  analyticsContext,
}: PublicPhotoGalleryStoryProps) {
  const storyId = useId();
  const storyRef = useRef<HTMLElement>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [opened, setOpened] = useState(false);
  const blocks = buildPhotoGalleryLayout(items);
  const total = items.length;

  useEffect(() => {
    const node = storyRef.current;
    if (!node) {
      return;
    }
    const onScroll = () => {
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight;
      const traveled = Math.max(0, -rect.top);
      const scrollable = Math.max(1, rect.height - viewport);
      setProgress(Math.min(1, traveled / scrollable));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const applyNavigation = useCallback(
    (
      fromIndex: number,
      toIndex: number,
      method: (typeof ANALYTICS_GALLERY_NAVIGATION_METHOD)[keyof typeof ANALYTICS_GALLERY_NAVIGATION_METHOD],
    ) => {
      const result = galleryAnalyticsEmissions({
        opened,
        items,
        action: {
          method,
          fromIndex,
          toIndex,
        },
      });
      emitGalleryAnalytics(contentItemId, analyticsContext, result.emissions);
      setOpened(result.opened);
      setLightboxIndex(result.index);
    },
    [analyticsContext, contentItemId, items, opened],
  );

  const openLightbox = useCallback(
    (index: number) => {
      const current = lightboxIndex ?? 0;
      applyNavigation(
        current,
        index,
        ANALYTICS_GALLERY_NAVIGATION_METHOD.THUMB,
      );
    },
    [applyNavigation, lightboxIndex],
  );

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  useEffect(() => {
    if (lightboxIndex === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        applyNavigation(
          lightboxIndex,
          stepGalleryIndex(lightboxIndex, total, -1),
          ANALYTICS_GALLERY_NAVIGATION_METHOD.KEYBOARD,
        );
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        applyNavigation(
          lightboxIndex,
          stepGalleryIndex(lightboxIndex, total, 1),
          ANALYTICS_GALLERY_NAVIGATION_METHOD.KEYBOARD,
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyNavigation, closeLightbox, lightboxIndex, total]);

  const lightboxItem =
    lightboxIndex === null ? null : items[currentGalleryIndex(lightboxIndex, total)];

  return (
    <>
      <div
        className="photo-gallery-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="Galeri ilerlemesi"
      >
        <span
          className="photo-gallery-progress__bar"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <section
        ref={storyRef}
        className="photo-gallery-story"
        aria-labelledby={`${storyId}-heading`}
      >
        <h2 id={`${storyId}-heading`} className="photo-gallery-story__heading">
          Fotoğraf Hikayesi
        </h2>
        <div className="photo-gallery-story__flow">
          {blocks.map((block, blockIndex) => (
            <PhotoGalleryStoryBlock
              key={
                block.type === "pair"
                  ? `${block.indices[0]}-${block.indices[1]}`
                  : block.item.mediaId
              }
              block={block}
              blockIndex={blockIndex}
              failed={failed}
              onImageError={(mediaId) =>
                setFailed((current) => ({ ...current, [mediaId]: true }))
              }
              onOpen={openLightbox}
            />
          ))}
        </div>
      </section>

      {lightboxItem ? (
        <PhotoGalleryLightbox
          item={lightboxItem}
          index={currentGalleryIndex(lightboxIndex ?? 0, total)}
          total={total}
          failed={failed[lightboxItem.mediaId] === true}
          onClose={closeLightbox}
          onPrev={() =>
            applyNavigation(
              lightboxIndex ?? 0,
              stepGalleryIndex(lightboxIndex ?? 0, total, -1),
              ANALYTICS_GALLERY_NAVIGATION_METHOD.PREV,
            )
          }
          onNext={() =>
            applyNavigation(
              lightboxIndex ?? 0,
              stepGalleryIndex(lightboxIndex ?? 0, total, 1),
              ANALYTICS_GALLERY_NAVIGATION_METHOD.NEXT,
            )
          }
          onImageError={() =>
            setFailed((current) => ({ ...current, [lightboxItem.mediaId]: true }))
          }
        />
      ) : null}
    </>
  );
}

function PhotoGalleryStoryBlock({
  block,
  blockIndex,
  failed,
  onImageError,
  onOpen,
}: {
  block: PhotoGalleryLayoutBlock;
  blockIndex: number;
  failed: Record<string, boolean>;
  onImageError: (mediaId: string) => void;
  onOpen: (index: number) => void;
}) {
  if (block.type === "pair") {
    return (
      <div className="photo-gallery-story__pair">
        {block.items.map((item, pairOffset) => (
          <PhotoGalleryStoryFrame
            key={item.mediaId}
            item={item}
            sequence={block.indices[pairOffset] + 1}
            layout="half"
            failed={failed[item.mediaId] === true}
            onImageError={onImageError}
            onOpen={() => onOpen(block.indices[pairOffset])}
          />
        ))}
      </div>
    );
  }

  return (
    <PhotoGalleryStoryFrame
      item={block.item}
      sequence={block.index + 1}
      layout={blockIndex % 3 === 0 ? "feature" : "full"}
      failed={failed[block.item.mediaId] === true}
      onImageError={onImageError}
      onOpen={() => onOpen(block.index)}
    />
  );
}

function PhotoGalleryStoryFrame({
  item,
  sequence,
  layout,
  failed,
  onImageError,
  onOpen,
}: {
  item: PublicArticleGalleryItem;
  sequence: number;
  layout: "full" | "feature" | "half";
  failed: boolean;
  onImageError: (mediaId: string) => void;
  onOpen: () => void;
}) {
  const width = item.width ?? 1200;
  const height = item.height ?? 800;

  return (
    <article
      className={`photo-gallery-frame photo-gallery-frame--${layout}`}
      data-sequence={sequence}
    >
      <div className="photo-gallery-frame__head">
        <span className="photo-gallery-frame__sequence">{String(sequence).padStart(2, "0")}</span>
        <span className="photo-gallery-frame__rule" aria-hidden="true" />
      </div>
      <button
        type="button"
        className="photo-gallery-frame__open"
        onClick={onOpen}
        aria-label={`Fotoğraf ${sequence} büyüt`}
      >
        <div
          className="photo-gallery-frame__media"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          {failed ? (
            <p className="photo-gallery-frame__missing">Görsel yüklenemedi</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              srcSet={item.srcSet ?? undefined}
              sizes={item.sizes ?? undefined}
              alt={item.altText ?? ""}
              width={width}
              height={height}
              className="photo-gallery-frame__image"
              loading="lazy"
              decoding="async"
              onError={() => onImageError(item.mediaId)}
            />
          )}
        </div>
      </button>
      {(item.caption || item.credit) ? (
        <div className="photo-gallery-frame__meta">
          {item.caption ? <p className="photo-gallery-frame__caption">{item.caption}</p> : null}
          {item.credit ? <p className="photo-gallery-frame__credit">{item.credit}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

function PhotoGalleryLightbox({
  item,
  index,
  total,
  failed,
  onClose,
  onPrev,
  onNext,
  onImageError,
}: {
  item: PublicArticleGalleryItem;
  index: number;
  total: number;
  failed: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onImageError: () => void;
}) {
  const width = item.width ?? 1200;
  const height = item.height ?? 800;

  return (
    <div className="photo-gallery-lightbox" role="dialog" aria-modal="true" aria-label="Foto galeri">
      <button
        type="button"
        className="photo-gallery-lightbox__backdrop"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div className="photo-gallery-lightbox__panel">
        <div className="photo-gallery-lightbox__toolbar">
          <p className="photo-gallery-lightbox__counter">
            {index + 1} / {total}
          </p>
          <button
            type="button"
            className="photo-gallery-lightbox__close"
            onClick={onClose}
            aria-label="Kapat"
          >
            Kapat
          </button>
        </div>
        <div
          className="photo-gallery-lightbox__stage"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          {failed ? (
            <p className="photo-gallery-lightbox__missing">Görsel yüklenemedi</p>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={item.mediaId}
              src={item.url}
              srcSet={item.srcSet ?? undefined}
              sizes="100vw"
              alt={item.altText ?? ""}
              width={width}
              height={height}
              className="photo-gallery-lightbox__image"
              decoding="async"
              onError={onImageError}
            />
          )}
        </div>
        <div className="photo-gallery-lightbox__meta">
          {item.caption ? (
            <p className="photo-gallery-lightbox__caption">{item.caption}</p>
          ) : null}
          {item.credit ? <p className="photo-gallery-lightbox__credit">{item.credit}</p> : null}
        </div>
        {total > 1 ? (
          <div className="photo-gallery-lightbox__controls">
            <button type="button" className="photo-gallery-lightbox__nav" onClick={onPrev}>
              Önceki
            </button>
            <button type="button" className="photo-gallery-lightbox__nav" onClick={onNext}>
              Sonraki
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
