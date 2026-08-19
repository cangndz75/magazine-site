"use client";

import { useId, useState } from "react";
import { VIDEO_TEXT_MAX } from "@magazine/domain";
import type { ArticleEditorVideo } from "@/lib/content/article-relation-state";
import {
  ARTICLE_VIDEO_EMPTY,
  ARTICLE_VIDEO_REMOVE_NOTE,
  formatVideoDuration,
  videoPosterFallbackLabel,
  videoProviderLabel,
} from "@/lib/video/presentation";
import {
  ArticleVideoPicker,
  videoPickerItemToEditorVideo,
} from "./article-video-picker";

type ArticleVideoSectionProps = {
  videos: ArticleEditorVideo[];
  disabled: boolean;
  busy: boolean;
  onPersist: (next: ArticleEditorVideo[]) => void;
};

function VideoThumb({
  previewUrl,
  provider,
  posterSource,
}: {
  previewUrl: string | null | undefined;
  provider: string;
  posterSource?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  if (!previewUrl || failed) {
    return (
      <p className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-500">
        {videoPosterFallbackLabel({ provider, posterSource })}
      </p>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={previewUrl}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function moveItem(
  items: ArticleEditorVideo[],
  index: number,
  direction: -1 | 1,
): ArticleEditorVideo[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) {
    return items;
  }
  const next = [...items];
  const current = next[index];
  const swap = next[target];
  if (!current || !swap) {
    return items;
  }
  next[index] = swap;
  next[target] = current;
  return next.map((item, sortOrder) => ({ ...item, sortOrder }));
}

export function ArticleVideoSection({
  videos,
  disabled,
  busy,
  onPersist,
}: ArticleVideoSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [captionDrafts, setCaptionDrafts] = useState<Record<string, string>>({});
  const captionBaseId = useId();
  const videosStamp = videos
    .map((item) => `${item.id}:${item.caption ?? ""}`)
    .join("|");
  const [boundStamp, setBoundStamp] = useState(videosStamp);
  if (boundStamp !== videosStamp) {
    setBoundStamp(videosStamp);
    setCaptionDrafts({});
  }

  return (
    <section className="space-y-3 md:col-span-2">
      <div>
        <h3 className="text-sm font-medium text-zinc-700">Videolar</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Sıra, ekleme ve çıkarma tek kayıtta yazılır. Yayındaki videolar haber
          yayımlanana kadar aynı kalır. Oynatma bir sonraki geçişte.
        </p>
      </div>

      {videos.length === 0 ? (
        <div className="flex min-h-28 flex-col items-start justify-center rounded border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5">
          <p className="text-sm text-zinc-600">{ARTICLE_VIDEO_EMPTY}</p>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setPickerOpen(true)}
            className="mt-3 h-9 rounded border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            Videodan içerik seç
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {videos.map((item, index) => {
            const captionId = `${captionBaseId}-${item.id}`;
            const displayCaption = item.caption ?? item.assetCaption;
            const captionValue = captionDrafts[item.id] ?? item.caption ?? "";
            return (
              <li
                key={item.id}
                className="rounded border border-zinc-200 bg-white p-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="h-20 w-full shrink-0 overflow-hidden bg-zinc-100 sm:h-20 sm:w-32">
                    <VideoThumb
                      previewUrl={item.posterPreviewUrl}
                      provider={item.provider}
                      posterSource={item.posterSource}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-500">
                      Sıra {index + 1} / {videos.length}
                    </p>
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-zinc-500">
                      {videoProviderLabel(item.provider)} ·{" "}
                      {formatVideoDuration(item.durationSeconds)}
                    </p>
                    {!item.rightsNote && !item.provenance ? (
                      <p className="mt-1 text-xs text-amber-800">
                        Kaynak/hak notu yok (bilgilendirme; yayını engellemez).
                      </p>
                    ) : null}
                    <label htmlFor={captionId} className="mt-2 block text-xs text-zinc-600">
                      Bu haberdeki başlık
                    </label>
                    <input
                      id={captionId}
                      value={captionValue}
                      maxLength={VIDEO_TEXT_MAX.CAPTION}
                      disabled={disabled || busy}
                      placeholder={displayCaption ?? ""}
                      onBlur={() =>
                        onPersist(
                          videos.map((entry) => ({
                            ...entry,
                            caption: (captionDrafts[entry.id] ?? entry.caption)?.trim()
                              ? (captionDrafts[entry.id] ?? entry.caption)
                              : null,
                          })),
                        )
                      }
                      onChange={(event) => {
                        setCaptionDrafts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }));
                      }}
                      className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm disabled:bg-zinc-50"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-label={`${item.title} videosunu yukarı taşı`}
                        disabled={disabled || busy || index === 0}
                        onClick={() => onPersist(moveItem(videos, index, -1))}
                        className="h-8 rounded border border-zinc-300 px-2 text-xs hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-40"
                      >
                        Yukarı
                      </button>
                      <button
                        type="button"
                        aria-label={`${item.title} videosunu aşağı taşı`}
                        disabled={disabled || busy || index === videos.length - 1}
                        onClick={() => onPersist(moveItem(videos, index, 1))}
                        className="h-8 rounded border border-zinc-300 px-2 text-xs hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-40"
                      >
                        Aşağı
                      </button>
                      <button
                        type="button"
                        aria-label={`${item.title} videosunu bu taslaktan kaldır`}
                        disabled={disabled || busy}
                        onClick={() =>
                          onPersist(videos.filter((entry) => entry.id !== item.id))
                        }
                        className="h-8 rounded border border-zinc-300 px-2 text-xs text-rose-800 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-40"
                      >
                        Kaldır
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {videos.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setPickerOpen(true)}
            className="h-9 rounded border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            Video ekle
          </button>
          <p className="text-xs text-zinc-500">{ARTICLE_VIDEO_REMOVE_NOTE}</p>
        </div>
      ) : null}

      <ArticleVideoPicker
        open={pickerOpen}
        usedIds={videos.map((item) => item.id)}
        disabled={disabled || busy}
        onClose={() => setPickerOpen(false)}
        onConfirm={(picked) => {
          onPersist([
            ...videos,
            ...picked.map((item, index) =>
              videoPickerItemToEditorVideo(item, videos.length + index),
            ),
          ]);
          setPickerOpen(false);
        }}
      />
    </section>
  );
}
