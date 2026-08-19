"use client";

import { useId, useState } from "react";
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
import { ArticleGalleryPicker, galleryPickerItemToEditorMedia } from "./article-gallery-picker";
import { MediaRightsStatusBadge } from "./media-rights-status-badge";
import type { ArticleEditorMedia } from "@/lib/content/article-relation-state";

type ArticleGallerySectionProps = {
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

function GalleryThumb({ previewUrl }: { previewUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!previewUrl || failed) {
    return (
      <p className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-500">
        Görsel yok
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

export function ArticleGallerySection({
  gallery,
  disabled,
  busy,
  onChange,
  onPersist,
}: ArticleGallerySectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const captionBaseId = useId();
  const altBaseId = useId();
  const creditBaseId = useId();

  return (
    <section className="space-y-3 md:col-span-2">
      <div>
        <h3 className="text-sm font-medium text-zinc-700">Galeri</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Sıra, ekleme ve çıkarma hemen kaydedilir. Alt metin, başlık ve kredi taslak
          kaydıyla yazılır. Yayındaki galeri, haber yayımlanana kadar aynı kalır.
        </p>
      </div>

      {gallery.length === 0 ? (
        <div className="flex min-h-28 flex-col items-start justify-center rounded border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5">
          <p className="text-sm text-zinc-600">Galeriden görsel seç</p>
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => setPickerOpen(true)}
            className="mt-3 h-9 rounded border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            Galeriden görsel seç
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {gallery.map((item, index) => {
            const captionId = `${captionBaseId}-${item.id}`;
            const altId = `${altBaseId}-${item.id}`;
            const creditId = `${creditBaseId}-${item.id}`;
            return (
              <li
                key={item.id}
                className="rounded border border-zinc-200 bg-white p-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="aspect-[3/2] w-full max-w-[9.5rem] shrink-0 overflow-hidden rounded bg-zinc-100">
                    <GalleryThumb previewUrl={item.previewUrl ?? null} />
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
                        <p>
                          Hak uyarısı — bilgilendirme içindir; yayını bu aşamada
                          engellemez.
                        </p>
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
                        disabled={disabled || busy || index === 0}
                        onClick={() => onPersist(moveItem(gallery, index, -1))}
                        className="h-9 rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                      >
                        Yukarı
                      </button>
                      <button
                        type="button"
                        disabled={disabled || busy || index === gallery.length - 1}
                        onClick={() => onPersist(moveItem(gallery, index, 1))}
                        className="h-9 rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                      >
                        Aşağı
                      </button>
                      <button
                        type="button"
                        disabled={disabled || busy}
                        onClick={() =>
                          onPersist(gallery.filter((entry) => entry.id !== item.id))
                        }
                        className="h-9 rounded px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                      >
                        Kaldır
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <label htmlFor={captionId} className="block text-sm font-medium text-zinc-700">
                      Galeri başlığı
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
                    <p className="mt-1 text-xs text-zinc-500">
                      Habere özel; dosya adı veya hak notu değildir.
                    </p>
                  </div>
                  <div>
                    <label htmlFor={altId} className="block text-sm font-medium text-zinc-700">
                      Bu habere özel alt metin
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
                    <label htmlFor={creditId} className="block text-sm font-medium text-zinc-700">
                      Habere özel kredi
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
                      Boşsa yayında medya kredi satırı kullanılır.
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {gallery.length > 0 ? (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => setPickerOpen(true)}
          className="h-9 rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
        >
          Görsel ekle
        </button>
      ) : null}

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
              ...items.map((item, index) =>
                galleryPickerItemToEditorMedia(item, gallery.length + index),
              ),
            ]);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
