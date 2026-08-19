"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MEDIA_TYPE, type MediaRightsStatus } from "@magazine/domain";
import { formatDimensions } from "@/lib/media/presentation";
import { MediaRightsStatusBadge } from "./media-rights-status-badge";

type PickerItem = {
  id: string;
  label: string;
  mediaType: string;
  width: number | null;
  height: number | null;
  previewUrl: string | null;
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

type VideoPosterPickerProps = {
  open: boolean;
  disabled: boolean;
  selectedId: string | null;
  onClose: () => void;
  onConfirm: (item: PickerItem | null) => void;
};

function readApiData<T>(response: Response, raw: string, fallback: string): T {
  const payload = (raw ? JSON.parse(raw) : {}) as ApiEnvelope<T>;
  if (!response.ok || payload.ok === false || payload.data === undefined) {
    throw new Error(payload.error?.message ?? fallback);
  }
  return payload.data;
}

export function VideoPosterPicker({
  open,
  disabled,
  selectedId,
  onClose,
  onConfirm,
}: VideoPosterPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<PickerItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(selectedId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      setPickedId(selectedId);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, selectedId]);

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

  const picked = items.find((item) => item.id === pickedId) ?? null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="video-poster-picker-title"
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
            <h2 id="video-poster-picker-title" className="text-base font-semibold">
              Poster görseli seç
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Yalnızca medya kütüphanesindeki görseller. Uzak poster URL’si kabul edilmez.
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
            Görsel ara
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Dosya adı, üretici, kredi…"
            className="mb-3 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          {error ? (
            <p className="mb-3 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="text-sm text-zinc-500">Görseller yükleniyor…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-zinc-600">
              {debouncedQuery
                ? "Aramanıza uygun görsel bulunamadı."
                : "Kütüphanede görsel yok."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((item) => {
                const selected = item.id === pickedId;
                const dimensions = formatDimensions(item.width, item.height);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setPickedId(item.id)}
                      aria-pressed={selected}
                      aria-label={`${item.label}${dimensions ? ` · ${dimensions}` : ""}`}
                      className={`flex w-full flex-col overflow-hidden rounded-lg border bg-white text-left focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                        selected
                          ? "border-zinc-900 ring-1 ring-zinc-900"
                          : "border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      <div className="aspect-[4/3] bg-zinc-100">
                        {item.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.previewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <p className="flex h-full items-center justify-center text-xs text-zinc-500">
                            Önizleme yok
                          </p>
                        )}
                      </div>
                      <div className="space-y-1 p-2">
                        <p className="truncate text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-zinc-500">
                          {dimensions || "Boyut yok"}
                        </p>
                        <MediaRightsStatusBadge
                          status={item.eligibility.status as MediaRightsStatus}
                          eligible={item.eligibility.eligible}
                          compact
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {nextCursor ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="mt-4 rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
            >
              {loadingMore ? "Yükleniyor…" : "Daha fazla yükle"}
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onConfirm(null)}
            className="h-9 rounded px-3 text-sm text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            Posteri kaldır
          </button>
          <button
            type="button"
            disabled={disabled || !picked}
            onClick={() => picked && onConfirm(picked)}
            className="h-9 rounded bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
          >
            Posteri seç
          </button>
        </div>
      </div>
    </dialog>
  );
}
