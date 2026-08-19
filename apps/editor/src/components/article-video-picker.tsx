"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  formatVideoDuration,
  videoPosterFallbackLabel,
  videoProviderLabel,
} from "@/lib/video/presentation";
import type { ArticleEditorVideo } from "@/lib/content/article-relation-state";

type PickerItem = {
  id: string;
  provider: string;
  providerVideoId: string;
  canonicalUrl: string;
  title: string;
  durationSeconds: number | null;
  posterPreviewUrl: string | null;
  posterSource: "EDITORIAL" | "PROVIDER" | "NONE";
};

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string };
};

type ArticleVideoPickerProps = {
  open: boolean;
  usedIds: readonly string[];
  disabled: boolean;
  onClose: () => void;
  onConfirm: (items: PickerItem[]) => void;
};

function toPickerCard(item: Record<string, unknown>): PickerItem {
  return {
    id: String(item.id ?? ""),
    provider: String(item.provider ?? ""),
    providerVideoId: String(item.providerVideoId ?? ""),
    canonicalUrl: String(item.canonicalUrl ?? ""),
    title: String(item.title ?? ""),
    durationSeconds:
      typeof item.durationSeconds === "number" ? item.durationSeconds : null,
    posterPreviewUrl:
      typeof item.posterPreviewUrl === "string" ? item.posterPreviewUrl : null,
    posterSource:
      item.posterSource === "EDITORIAL" || item.posterSource === "PROVIDER"
        ? item.posterSource
        : "NONE",
  };
}

function readApiData<T>(response: Response, raw: string, fallback: string): T {
  const payload = (raw ? JSON.parse(raw) : {}) as ApiEnvelope<T>;
  if (!response.ok || payload.ok === false || payload.data === undefined) {
    throw new Error(payload.error?.message ?? fallback);
  }
  return payload.data;
}

export function ArticleVideoPicker({
  open,
  usedIds,
  disabled,
  onClose,
  onConfirm,
}: ArticleVideoPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchId = useId();
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
      setSelectedIds([]);
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
    params.set("pageSize", "24");
    if (debouncedQuery) {
      params.set("q", debouncedQuery);
    }
    void fetch(`/api/videos?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const raw = await response.text();
        const data = readApiData<{
          items: Array<PickerItem & Record<string, unknown>>;
          nextCursor: string | null;
        }>(response, raw, "Video listesi yüklenemedi.");
        if (controller.signal.aborted) {
          return;
        }
        setItems(data.items.map((item) => toPickerCard(item)));
        setNextCursor(data.nextCursor);
        setError(null);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          caught instanceof Error ? caught.message : "Video listesi yüklenemedi.",
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
      params.set("pageSize", "24");
      params.set("cursor", nextCursor);
      if (debouncedQuery) {
        params.set("q", debouncedQuery);
      }
      const response = await fetch(`/api/videos?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const raw = await response.text();
      const data = readApiData<{
        items: Array<PickerItem & Record<string, unknown>>;
        nextCursor: string | null;
      }>(response, raw, "Video listesi yüklenemedi.");
      setItems((current) => [
        ...current,
        ...data.items.map((item) => toPickerCard(item)),
      ]);
      setNextCursor(data.nextCursor);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Video listesi yüklenemedi.",
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
      aria-labelledby="article-video-picker-title"
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
            <h2 id="article-video-picker-title" className="text-base font-semibold">
              Videodan içerik seç
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Birden fazla video seçin, sonra ekleyin. Kütüphane varlığı silinmez.
              Oynatma bir sonraki geçişte.
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
            Video ara
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Başlık, video kimliği, sağlayıcı…"
            className="mb-3 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          {error ? (
            <p className="mb-3 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="text-sm text-zinc-500">Videolar yükleniyor…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-zinc-600">
              {debouncedQuery
                ? "Aramanıza uygun video bulunamadı."
                : "Video kütüphanesi boş."}
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const alreadyUsed = used.has(item.id);
                const selected = selectedIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={alreadyUsed}
                      onClick={() => toggle(item)}
                      aria-pressed={selected}
                      aria-label={`${item.title} — ${videoProviderLabel(item.provider)}${
                        alreadyUsed ? " (zaten ekli)" : ""
                      }`}
                      className={`flex w-full items-center gap-3 rounded border px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected
                          ? "border-zinc-900 ring-1 ring-zinc-900"
                          : "border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      <div className="h-12 w-20 shrink-0 overflow-hidden bg-zinc-100">
                        {item.posterPreviewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.posterPreviewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <p className="flex h-full items-center justify-center px-1 text-center text-[10px] text-zinc-500">
                            {videoPosterFallbackLabel(item)}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-zinc-500">
                          {videoProviderLabel(item.provider)} ·{" "}
                          {formatVideoDuration(item.durationSeconds)}
                        </p>
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
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded px-3 text-sm text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={disabled || selectedItems.length === 0}
            onClick={() => onConfirm(selectedItems)}
            className="h-9 rounded bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
          >
            Seçilenleri ekle
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function videoPickerItemToEditorVideo(
  item: PickerItem,
  sortOrder: number,
): ArticleEditorVideo {
  return {
    id: item.id,
    provider: item.provider,
    providerVideoId: item.providerVideoId,
    canonicalUrl: item.canonicalUrl,
    title: item.title,
    caption: null,
    assetCaption: null,
    durationSeconds: item.durationSeconds,
    posterMediaId: null,
    posterPreviewUrl: item.posterPreviewUrl,
    posterSource: item.posterSource,
    rightsNote: null,
    provenance: null,
    sortOrder,
  };
}
