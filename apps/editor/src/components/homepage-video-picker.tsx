"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  formatVideoDuration,
  videoPosterFallbackLabel,
  videoProviderLabel,
} from "@/lib/video/presentation";

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

type HomepageVideoPickerProps = {
  open: boolean;
  disabled: boolean;
  onClose: () => void;
  onConfirm: (item: PickerItem) => void;
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

export function HomepageVideoPicker({
  open,
  disabled,
  onClose,
  onConfirm,
}: HomepageVideoPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<PickerItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      setSelectedId(null);
      setLoading(true);
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

  const selectedItem = selectedId
    ? items.find((item) => item.id === selectedId)
    : undefined;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="homepage-video-picker-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!disabled) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-[min(100%,42rem)] rounded-lg border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40"
    >
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <div>
          <h2
            id="homepage-video-picker-title"
            className="text-base font-semibold text-zinc-900"
          >
            Video seç
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Video kütüphanesinden bir editorial video seçin. URL girişi yok.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onClose}
          className="rounded px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
        >
          Kapat
        </button>
      </div>

      <div className="px-4 py-3">
        <label className="block text-xs font-medium text-zinc-600" htmlFor={searchId}>
          Video ara
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Başlık, sağlayıcı, video kimliği…"
          className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="max-h-[50vh] overflow-y-auto px-4">
        {loading ? (
          <p className="py-6 text-center text-sm text-zinc-500">Videolar yükleniyor…</p>
        ) : error ? (
          <p className="py-6 text-center text-sm text-red-700" role="alert">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Sonuç bulunamadı.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {items.map((item) => {
              const selected = selectedId === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedId(item.id)}
                    className={`flex w-full gap-3 px-1 py-3 text-left hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
                      selected ? "bg-zinc-50 ring-1 ring-inset ring-zinc-300" : ""
                    }`}
                    aria-pressed={selected}
                  >
                    <div
                      className="flex h-14 w-24 shrink-0 items-center justify-center rounded bg-zinc-100 text-[10px] text-zinc-500"
                      aria-hidden={item.posterPreviewUrl ? undefined : true}
                    >
                      {item.posterPreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.posterPreviewUrl}
                          alt=""
                          className="h-full w-full rounded object-cover"
                        />
                      ) : (
                        videoPosterFallbackLabel({
                          provider: item.provider,
                          posterSource: item.posterSource,
                        })
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900">{item.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {videoProviderLabel(item.provider)}
                        {item.durationSeconds
                          ? ` · ${formatVideoDuration(item.durationSeconds)}`
                          : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {nextCursor ? (
          <div className="py-3 text-center">
            <button
              type="button"
              disabled={disabled || loadingMore}
              onClick={() => void loadMore()}
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              {loadingMore ? "Yükleniyor…" : "Daha fazla"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t border-zinc-100 px-4 py-3">
        <button
          type="button"
          disabled={disabled}
          onClick={onClose}
          className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Vazgeç
        </button>
        <button
          type="button"
          disabled={disabled || !selectedItem}
          onClick={() => {
            if (selectedItem) {
              onConfirm(selectedItem);
            }
          }}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          Seç
        </button>
      </div>
    </dialog>
  );
}

export type { PickerItem as HomepageVideoPickerItem };
