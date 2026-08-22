"use client";

import { useId, useState, type DragEvent } from "react";
import {
  ARTICLE_GALLERY_CAPTION_MAX,
  ARTICLE_HERO_ALT_TEXT_MAX,
  MEDIA_RIGHTS_STATUS,
  MEDIA_RIGHTS_TEXT_MAX,
  type MediaPublicIneligibilityReason,
  type MediaRightsStatus,
} from "@magazine/domain";
import {
  formatDimensions,
  INELIGIBILITY_REASON_LABELS,
} from "@/lib/media/presentation";
import {
  ArticleGalleryPicker,
  galleryPickerItemToEditorMedia,
} from "@/components/article-gallery-picker";
import { MediaRightsStatusBadge } from "@/components/media-rights-status-badge";
import type { ArticleEditorMedia } from "@/lib/content/article-relation-state";

type PhotoGalleryImageManagerProps = {
  gallery: ArticleEditorMedia[];
  disabled: boolean;
  busy: boolean;
  onChange: (next: ArticleEditorMedia[]) => void;
  onPersist: (next: ArticleEditorMedia[]) => void;
};

function publicCredit(item: ArticleEditorMedia): string {
  const override = item.credit?.trim();
  if (override) {
    return override;
  }
  return item.creditLine?.trim() || "Kredi yok";
}

function GalleryThumb({ previewUrl, alt }: { previewUrl: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!previewUrl || failed) {
    return (
      <p className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-500">
        Önizleme yok
      </p>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={previewUrl}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function moveItem(
  items: ArticleEditorMedia[],
  index: number,
  direction: -1 | 1,
): ArticleEditorMedia[] {
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

function reorderItems(
  items: ArticleEditorMedia[],
  fromIndex: number,
  toIndex: number,
): ArticleEditorMedia[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) {
    return items;
  }
  next.splice(toIndex, 0, moved);
  return next.map((item, sortOrder) => ({ ...item, sortOrder }));
}

export function PhotoGalleryImageManager({
  gallery,
  disabled,
  busy,
  onChange,
  onPersist,
}: PhotoGalleryImageManagerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const captionBaseId = useId();
  const altBaseId = useId();
  const creditBaseId = useId();

  function handleDragStart(index: number) {
    if (disabled || busy) {
      return;
    }
    setDragIndex(index);
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    onPersist(reorderItems(gallery, dragIndex, targetIndex));
    setDragIndex(null);
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>) {
    event.preventDefault();
  }

  return (
    <section
      id="editor-section-gallery-sequence"
      className="scroll-mt-28 space-y-4 rounded border border-zinc-200 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Galeri görsel sırası</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Sıra, ekleme ve çıkarma hemen kaydedilir. Açıklama, alt metin ve kredi taslak
            kaydıyla yazılır.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => setPickerOpen(true)}
          className="h-10 shrink-0 rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-magenta disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          + Galeriye Görsel Ekle
        </button>
      </div>

      {gallery.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-zinc-800">
            Galeriye henüz görsel eklenmedi.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Kapak görseli ve en az bir galeri görseli yayın için gereklidir.
          </p>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setPickerOpen(true)}
            className="mt-4 h-10 rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand-magenta disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            + Galeriye Görsel Ekle
          </button>
        </div>
      ) : (
        <ol className="space-y-3" aria-label="Galeri görselleri">
          {gallery.map((item, index) => {
            const captionId = `${captionBaseId}-${item.id}`;
            const altId = `${altBaseId}-${item.id}`;
            const creditId = `${creditBaseId}-${item.id}`;
            const dragging = dragIndex === index;

            return (
              <li
                key={item.id}
                draggable={!disabled && !busy}
                onDragStart={() => handleDragStart(index)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(index)}
                className={`rounded border bg-white p-3 transition ${
                  dragging
                    ? "border-brand-magenta/60 ring-2 ring-brand-magenta/20"
                    : "border-zinc-200"
                }`}
              >
                <div className="flex gap-3">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Görsel ${index + 1} sırasını değiştir`}
                      disabled={disabled || busy}
                      className="flex h-9 w-9 cursor-grab items-center justify-center rounded border border-zinc-200 text-xs text-zinc-500 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 active:cursor-grabbing disabled:cursor-not-allowed"
                      title="Sürükleyerek sırala"
                    >
                      ⋮⋮
                    </button>
                    <span
                      className="text-xs font-bold tabular-nums text-brand-magenta"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="aspect-[4/3] w-24 shrink-0 overflow-hidden rounded bg-zinc-100 sm:w-28">
                    <GalleryThumb
                      previewUrl={item.previewUrl ?? null}
                      alt={item.altText?.trim() || item.label}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-950">
                          {item.label}
                        </p>
                        <p className="text-xs text-zinc-500">
                          Sıra {index + 1} / {gallery.length}
                          {formatDimensions(item.width, item.height)
                            ? ` · ${formatDimensions(item.width, item.height)}`
                            : ""}
                        </p>
                      </div>
                      {item.eligibility ? (
                        <MediaRightsStatusBadge
                          status={
                            (item.eligibility.status as MediaRightsStatus) ??
                            MEDIA_RIGHTS_STATUS.INCOMPLETE
                          }
                          eligible={item.eligibility.eligible}
                        />
                      ) : null}
                    </div>

                    {item.eligibility && !item.eligibility.eligible ? (
                      <div
                        className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950"
                        role="status"
                      >
                        <p className="font-medium">Public kullanım kısıtlı</p>
                        {item.eligibility.reasons.length > 0 ? (
                          <ul className="mt-1 list-disc pl-4">
                            {item.eligibility.reasons.map((reason) => (
                              <li key={reason}>
                                {INELIGIBILITY_REASON_LABELS[
                                  reason as MediaPublicIneligibilityReason
                                ] ?? reason}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}

                    <p className="text-xs text-zinc-600">
                      Yayında görünecek kredi: {publicCredit(item)}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        aria-label={`Görsel ${index + 1} yukarı taşı`}
                        disabled={disabled || busy || index === 0}
                        onClick={() => onPersist(moveItem(gallery, index, -1))}
                        className="min-h-9 min-w-[4.5rem] rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                      >
                        Yukarı
                      </button>
                      <button
                        type="button"
                        aria-label={`Görsel ${index + 1} aşağı taşı`}
                        disabled={disabled || busy || index === gallery.length - 1}
                        onClick={() => onPersist(moveItem(gallery, index, 1))}
                        className="min-h-9 min-w-[4.5rem] rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                      >
                        Aşağı
                      </button>
                      <button
                        type="button"
                        aria-label={`Görsel ${index + 1} galeriden kaldır`}
                        disabled={disabled || busy}
                        onClick={() =>
                          onPersist(gallery.filter((entry) => entry.id !== item.id))
                        }
                        className="min-h-9 rounded px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:text-zinc-400"
                      >
                        Galeriden kaldır
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <div>
                    <label
                      htmlFor={captionId}
                      className="block text-xs font-semibold uppercase tracking-wide text-zinc-600"
                    >
                      Açıklama
                    </label>
                    <textarea
                      id={captionId}
                      rows={2}
                      maxLength={ARTICLE_GALLERY_CAPTION_MAX}
                      disabled={disabled}
                      value={item.caption ?? ""}
                      onChange={(event) =>
                        onChange(
                          gallery.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, caption: event.target.value || null }
                              : entry,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={altId}
                      className="block text-xs font-semibold uppercase tracking-wide text-zinc-600"
                    >
                      Alt metin
                    </label>
                    <textarea
                      id={altId}
                      rows={2}
                      maxLength={ARTICLE_HERO_ALT_TEXT_MAX}
                      disabled={disabled}
                      value={item.altText ?? ""}
                      onChange={(event) =>
                        onChange(
                          gallery.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, altText: event.target.value || null }
                              : entry,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={creditId}
                      className="block text-xs font-semibold uppercase tracking-wide text-zinc-600"
                    >
                      Kredi
                    </label>
                    <input
                      id={creditId}
                      maxLength={MEDIA_RIGHTS_TEXT_MAX.CREDIT}
                      disabled={disabled}
                      value={item.credit ?? ""}
                      onChange={(event) =>
                        onChange(
                          gallery.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, credit: event.target.value || null }
                              : entry,
                          ),
                        )
                      }
                      className="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50"
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                      Bu galeriye özel; boşsa medya kredi satırı kullanılır.
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {busy ? (
        <p className="text-xs text-zinc-500" role="status">
          Galeri kaydediliyor…
        </p>
      ) : null}

      {pickerOpen ? (
        <ArticleGalleryPicker
          open={pickerOpen}
          usedIds={gallery.map((item) => item.id)}
          disabled={busy}
          onClose={() => setPickerOpen(false)}
          onConfirm={(items) => {
            onPersist([
              ...gallery,
              ...items.map((item, offset) =>
                galleryPickerItemToEditorMedia(item, gallery.length + offset),
              ),
            ]);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
