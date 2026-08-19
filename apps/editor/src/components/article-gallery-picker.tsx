"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  MEDIA_RIGHTS_STATUS,
  MEDIA_TYPE,
  type MediaRightsStatus,
} from "@magazine/domain";
import { MediaRightsStatusBadge } from "./media-rights-status-badge";
import type { ArticleEditorMedia } from "@/lib/content/article-relation-state";

type PickerItem = {
  id: string;
  label: string;
  mediaType: string;
  width: number | null;
  height: number | null;
  previewUrl: string | null;
  creatorName: string | null;
  creditLine: string | null;
  eligibility: {
    eligible: boolean;
    status: string;
    reasons: string[];
  };
};

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string };
};

type ArticleGalleryPickerProps = {
  open: boolean;
  usedIds: readonly string[];
  disabled: boolean;
  onClose: () => void;
  onConfirm: (items: PickerItem[]) => void;
};

function readApiData<T>(response: Response, raw: string, fallback: string): T {
  const payload = (raw ? JSON.parse(raw) : {}) as ApiEnvelope<T>;
  if (!response.ok || payload.ok === false || payload.data === undefined) {
    throw new Error(payload.error?.message ?? fallback);
  }
  return payload.data;
}

export function ArticleGalleryPicker({
  open,
  usedIds,
  disabled,
  onClose,
  onConfirm,
}: ArticleGalleryPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchId = useId();
  const statusId = useId();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<PickerItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const used = new Set(usedIds);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set("type", MEDIA_TYPE.IMAGE);
    params.set("pageSize", "24");
    if (debouncedQuery) {
      params.set("q", debouncedQuery);
    }
    void fetch(`/api/media?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const raw = await response.text();
        const data = readApiData<{
          items: PickerItem[];
          nextCursor: string | null;
        }>(response, raw, "Medya listesi yüklenemedi.");
        if (controller.signal.aborted) {
          return;
        }
        setItems(data.items.filter((item) => item.mediaType === MEDIA_TYPE.IMAGE));
        setNextCursor(data.nextCursor);
        setError(null);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          caught instanceof Error ? caught.message : "Medya listesi yüklenemedi.",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedQuery, open]);

  async function loadMore() {
    if (!nextCursor) {
      return;
    }
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set("type", MEDIA_TYPE.IMAGE);
      params.set("pageSize", "24");
      params.set("cursor", nextCursor);
      if (debouncedQuery) {
        params.set("q", debouncedQuery);
      }
      const response = await fetch(`/api/media?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const raw = await response.text();
      const data = readApiData<{
        items: PickerItem[];
        nextCursor: string | null;
      }>(response, raw, "Medya listesi yüklenemedi.");
      setItems((current) => [
        ...current,
        ...data.items.filter((item) => item.mediaType === MEDIA_TYPE.IMAGE),
      ]);
      setNextCursor(data.nextCursor);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Medya listesi yüklenemedi.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  function toggle(item: PickerItem) {
    if (used.has(item.id)) {
      return;
    }
    setSelectedIds((current) =>
      current.includes(item.id)
        ? current.filter((id) => id !== item.id)
        : [...current, item.id],
    );
  }

  const selectedItems = selectedIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is PickerItem => Boolean(item));

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="article-gallery-picker-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!disabled) {
          onClose();
        }
      }}
      className="w-[min(64rem,calc(100vw-1.5rem))] max-h-[min(40rem,calc(100vh-1.5rem))] overflow-hidden rounded-lg border border-zinc-200 bg-white p-0 text-zinc-900 shadow-lg backdrop:bg-zinc-950/40"
    >
      <div className="flex max-h-[min(40rem,calc(100vh-1.5rem))] flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <h2
              id="article-gallery-picker-title"
              className="text-base font-semibold"
            >
              Galeriden görsel seç
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Birden fazla görsel seçin, sonra ekleyin. Hak uyarıları
              bilgilendirme içindir; yayını engellemez.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            Kapat
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <label htmlFor={searchId} className="sr-only">
            Medya ara
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Dosya adı, kredi veya kaynak ara…"
            className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
          <p id={statusId} className="sr-only" role="status">
            {loading
              ? "Medya yükleniyor"
              : error ?? `${items.length} görsel, ${selectedIds.length} seçili`}
          </p>
          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : loading ? (
            <p className="mt-3 text-sm text-zinc-500">Yükleniyor…</p>
          ) : items.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Eşleşen görsel yok.</p>
          ) : (
            <ul
              className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
              role="listbox"
              aria-multiselectable="true"
              aria-label="Galeri görselleri"
            >
              {items.map((item) => {
                const alreadyUsed = used.has(item.id);
                const selected = selectedIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={alreadyUsed}
                      onClick={() => toggle(item)}
                      className={`flex w-full flex-col overflow-hidden rounded border text-left focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed ${
                        selected
                          ? "border-zinc-900 ring-2 ring-zinc-900"
                          : alreadyUsed
                            ? "border-zinc-200 opacity-60"
                            : "border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      <span className="relative block aspect-[3/2] bg-zinc-100">
                        {item.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.previewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center px-2 text-center text-xs text-zinc-500">
                            Önizleme yok
                          </span>
                        )}
                        <span
                          className={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border text-[10px] font-semibold ${
                            selected
                              ? "border-zinc-950 bg-zinc-950 text-white"
                              : "border-zinc-400 bg-white text-transparent"
                          }`}
                          aria-hidden="true"
                        >
                          {selected ? "✓" : ""}
                        </span>
                      </span>
                      <span className="flex items-start justify-between gap-1 px-2 py-1.5">
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-zinc-900">
                            {item.label}
                          </span>
                          {alreadyUsed ? (
                            <span className="block text-[10px] font-medium text-zinc-600">
                              Galeride
                            </span>
                          ) : selected ? (
                            <span className="block text-[10px] font-medium text-zinc-700">
                              Seçildi
                            </span>
                          ) : null}
                        </span>
                        <MediaRightsStatusBadge
                          status={
                            (item.eligibility.status as MediaRightsStatus) ??
                            MEDIA_RIGHTS_STATUS.INCOMPLETE
                          }
                          eligible={item.eligibility.eligible}
                          compact
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {nextCursor ? (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="mt-3 h-9 rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:text-zinc-400"
            >
              {loadingMore ? "Yükleniyor…" : "Daha fazla"}
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3">
          <p className="text-sm text-zinc-600">{selectedIds.length} görsel seçildi</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={selectedItems.length === 0 || disabled}
              onClick={() => onConfirm(selectedItems)}
              className="h-9 rounded bg-zinc-950 px-3 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              Galeriyi ekle
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

export function galleryPickerItemToEditorMedia(
  item: PickerItem,
  sortOrder: number,
): ArticleEditorMedia {
  return {
    id: item.id,
    label: item.label,
    mediaType: item.mediaType,
    width: item.width,
    height: item.height,
    role: "GALLERY",
    sortOrder,
    caption: null,
    altText: null,
    credit: null,
    previewUrl: item.previewUrl,
    creatorName: item.creatorName,
    creditLine: item.creditLine,
    eligibility: item.eligibility,
  };
}
