"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VIDEO_PROVIDER } from "@magazine/domain";
import { formatDateTime } from "@/lib/content/format-date";
import type { VideoLibraryQuery } from "@/lib/video/params";
import {
  formatVideoDuration,
  videoPosterFallbackLabel,
  videoProviderLabel,
  videoRightsSummary,
  VIDEO_LIBRARY_EMPTY,
  VIDEO_LIBRARY_NO_RESULTS,
} from "@/lib/video/presentation";
import { VideoAddDialog } from "./video-add-dialog";
import { VideoInspector, type VideoInspectorData } from "./video-inspector";

type ListItem = {
  id: string;
  provider: string;
  providerVideoId: string;
  canonicalUrl: string;
  title: string;
  caption: string | null;
  durationSeconds: number | null;
  posterMediaId: string | null;
  posterSource: "EDITORIAL" | "PROVIDER" | "NONE";
  posterPreviewUrl: string | null;
  posterWidth: number | null;
  posterHeight: number | null;
  hasRightsNote: boolean;
  hasProvenance: boolean;
  usageCount: number;
  updatedAt: string;
};

type ListResponse = {
  items: ListItem[];
  nextCursor: string | null;
  totalCount: number;
};

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

const DEBOUNCE_MS = 300;
const LG_MEDIA_QUERY = "(min-width: 1024px)";

function useIsLgViewport() {
  const [isLg, setIsLg] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(LG_MEDIA_QUERY);
    const sync = () => setIsLg(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  return isLg;
}

function readApiData<T>(response: Response, raw: string, fallback: string): T {
  const payload = (raw ? JSON.parse(raw) : {}) as ApiEnvelope<T>;
  if (!response.ok || payload.ok === false || payload.data === undefined) {
    throw new Error(payload.error?.message ?? fallback);
  }
  return payload.data;
}

function filtersToApiSearchParams(
  filters: VideoLibraryQuery,
  cursor?: string | null,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.provider) {
    params.set("provider", filters.provider);
  }
  if (filters.poster) {
    params.set("poster", filters.poster);
  }
  if (filters.used) {
    params.set("used", "1");
  }
  if (filters.unused) {
    params.set("unused", "1");
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  if (filters.pageSize) {
    params.set("pageSize", String(filters.pageSize));
  }
  return params;
}

type VideoLibraryWorkspaceProps = {
  canEdit: boolean;
  filters: VideoLibraryQuery;
  selectedId: string | null;
};

export function VideoLibraryWorkspace({
  canEdit,
  filters,
  selectedId: selectedIdFromPage,
}: VideoLibraryWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(null);
  const effectiveSelectedId = selectedIdFromPage ?? pendingSelectedId;
  const [inspector, setInspector] = useState<VideoInspectorData | null>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorError, setInspectorError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const isLgViewport = useIsLgViewport();
  const [debouncedSearch, setDebouncedSearch] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const searchInput = debouncedSearch ?? filters.q ?? "";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchList = useCallback(
    async (listFilters: VideoLibraryQuery, cursor?: string | null) => {
      if (!cursor) {
        setListLoading(true);
      }
      setListError(null);
      try {
        const params = filtersToApiSearchParams(listFilters, cursor);
        const response = await fetch(`/api/videos?${params.toString()}`, {
          cache: "no-store",
        });
        const raw = await response.text();
        const payload = readApiData<ListResponse>(
          response,
          raw,
          "Liste yüklenemedi.",
        );
        if (cursor) {
          setItems((current) => [...current, ...payload.items]);
        } else {
          setItems(payload.items);
        }
        setTotalCount(payload.totalCount);
        setNextCursor(payload.nextCursor);
      } catch (caught) {
        setListError(
          caught instanceof Error ? caught.message : "Liste yüklenemedi.",
        );
      } finally {
        setListLoading(false);
      }
    },
    [],
  );

  const loadInspector = useCallback(async (videoAssetId: string) => {
    setInspectorLoading(true);
    setInspectorError(null);
    setSaveState("idle");
    setSaveError(null);
    try {
      const response = await fetch(`/api/videos/${videoAssetId}`, {
        cache: "no-store",
      });
      const raw = await response.text();
      const payload = readApiData<VideoInspectorData>(
        response,
        raw,
        "Detay yüklenemedi.",
      );
      setInspector(payload);
    } catch (caught) {
      setInspector(null);
      setInspectorError(
        caught instanceof Error ? caught.message : "Detay yüklenemedi.",
      );
    } finally {
      setInspectorLoading(false);
    }
  }, []);

  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) {
        await fetchList(filters);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchList, filtersKey, filters]);

  useEffect(() => {
    if (!selectedIdFromPage) {
      return;
    }
    let cancelled = false;
    void (async () => {
      if (!cancelled) {
        await loadInspector(selectedIdFromPage);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedIdFromPage, loadInspector]);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value.length === 0) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("cursor");
    router.replace(`/videos?${params.toString()}`);
  }

  function selectVideo(id: string) {
    setPendingSelectedId(id);
    if (!window.matchMedia(LG_MEDIA_QUERY).matches) {
      setMobileInspectorOpen(true);
    } else {
      setMobileInspectorOpen(false);
    }
    updateParams({ selected: id });
    void loadInspector(id);
  }

  function clearSelection() {
    setPendingSelectedId(null);
    setInspector(null);
    setInspectorError(null);
    setMobileInspectorOpen(false);
    updateParams({ selected: null });
  }

  function handleSearchChange(value: string) {
    setDebouncedSearch(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(null);
      updateParams({ q: value.trim().length > 0 ? value : null });
    }, DEBOUNCE_MS);
  }

  async function handleSave(payload: {
    providerUrlOrId: string;
    title: string;
    caption: string | null;
    description: string | null;
    durationSeconds: number | null;
    posterMediaId: string | null;
    rightsNote: string | null;
    provenance: string | null;
    expectedUpdatedAt: string;
  }) {
    if (!effectiveSelectedId) {
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      const response = await fetch(`/api/videos/${effectiveSelectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await response.text();
      const parsed = (raw ? JSON.parse(raw) : {}) as ApiEnvelope<VideoInspectorData>;
      if (!response.ok || parsed.ok === false || !parsed.data) {
        setSaveState("error");
        setSaveError(parsed.error?.message ?? "Kayıt başarısız.");
        return;
      }
      setInspector(parsed.data);
      setSaveState("saved");
      await fetchList(filters);
    } catch (caught) {
      setSaveState("error");
      setSaveError(caught instanceof Error ? caught.message : "Kayıt başarısız.");
    }
  }

  const emptyState =
    !listLoading && items.length === 0
      ? filters.q || filters.provider || filters.poster || filters.used || filters.unused
        ? VIDEO_LIBRARY_NO_RESULTS
        : VIDEO_LIBRARY_EMPTY
      : null;

  return (
    <div className="mx-auto min-w-0 max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Video Kütüphanesi</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {totalCount} video · YouTube ve Vimeo bağlantıları. Doğrudan dosya yüklemesi yok.
            Oynatma bir sonraki geçişte.
          </p>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-3 rounded bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            >
              Video ekle
            </button>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="min-w-0 text-sm sm:flex-1">
            <span className="sr-only">Video ara</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Başlık, video kimliği, sağlayıcı, başlık metni…"
              className="w-full min-w-0 rounded border border-zinc-300 px-3 py-2 sm:max-w-xs"
              aria-label="Video ara"
            />
          </label>
          <select
            aria-label="Sağlayıcı filtresi"
            className="min-w-0 rounded border border-zinc-300 px-3 py-2 text-sm"
            value={filters.provider ?? ""}
            onChange={(event) =>
              updateParams({ provider: event.target.value || null })
            }
          >
            <option value="">Tüm sağlayıcılar</option>
            <option value={VIDEO_PROVIDER.YOUTUBE}>YouTube</option>
            <option value={VIDEO_PROVIDER.VIMEO}>Vimeo</option>
          </select>
          <select
            aria-label="Poster filtresi"
            className="min-w-0 rounded border border-zinc-300 px-3 py-2 text-sm"
            value={filters.poster ?? ""}
            onChange={(event) =>
              updateParams({ poster: event.target.value || null })
            }
          >
            <option value="">Tüm posterler</option>
            <option value="present">Editoryal poster var</option>
            <option value="absent">Editoryal poster yok</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <FilterToggle
          label="Kullanılıyor"
          active={filters.used === true}
          onClick={() =>
            updateParams({
              used: filters.used ? null : "1",
              unused: null,
            })
          }
        />
        <FilterToggle
          label="Kullanılmıyor"
          active={filters.unused === true}
          onClick={() =>
            updateParams({
              unused: filters.unused ? null : "1",
              used: null,
            })
          }
        />
      </div>

      {listError ? (
        <p className="mt-4 text-sm text-rose-700" role="alert">
          {listError}
        </p>
      ) : null}

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-label="Video listesi" className="min-w-0">
          {listLoading && items.length === 0 ? (
            <p className="text-sm text-zinc-500">Video listesi yükleniyor…</p>
          ) : null}
          {emptyState ? (
            <p className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
              {emptyState}
            </p>
          ) : null}
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
              const selected = item.id === effectiveSelectedId;
              return (
                <li key={item.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => selectVideo(item.id)}
                    aria-pressed={selected}
                    aria-label={`${item.title} — ${videoProviderLabel(item.provider)}`}
                    className={`flex w-full min-w-0 gap-3 overflow-hidden rounded-lg border bg-white p-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
                      selected
                        ? "border-zinc-900 ring-1 ring-zinc-900"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <div className="h-16 w-24 shrink-0 overflow-hidden bg-zinc-100">
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-zinc-500">
                        {videoProviderLabel(item.provider)} ·{" "}
                        {formatVideoDuration(item.durationSeconds)}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {videoRightsSummary(item)}
                        {item.usageCount > 0 ? ` · ${item.usageCount} kullanım` : ""}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {formatDateTime(item.updatedAt)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {nextCursor ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void fetchList(filters, nextCursor)}
                disabled={listLoading}
                className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-white disabled:opacity-60"
              >
                Daha fazla yükle
              </button>
            </div>
          ) : null}
        </section>
        <aside
          className="hidden min-h-[480px] min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white lg:block"
          aria-label="Video inceleyici"
        >
          <VideoInspector
            data={inspector}
            loading={inspectorLoading}
            error={inspectorError}
            canEdit={canEdit}
            saveState={saveState}
            saveError={saveError}
            onSave={(payload) => {
              void handleSave(payload);
            }}
          />
        </aside>
      </div>

      {!isLgViewport && mobileInspectorOpen && effectiveSelectedId ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          role="presentation"
          onClick={() => clearSelection()}
        >
          <div
            className="absolute inset-x-0 bottom-0 top-12 max-w-full overflow-hidden rounded-t-xl bg-white"
            role="dialog"
            aria-modal="true"
            aria-label="Video detayı"
            onClick={(event) => event.stopPropagation()}
          >
            <VideoInspector
              data={inspector}
              loading={inspectorLoading}
              error={inspectorError}
              canEdit={canEdit}
              saveState={saveState}
              saveError={saveError}
              onSave={(payload) => {
                void handleSave(payload);
              }}
              onClose={() => clearSelection()}
            />
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <VideoAddDialog
          open={addOpen}
          disabled={!canEdit}
          onClose={() => setAddOpen(false)}
          onCreated={(id) => {
            void (async () => {
              await fetchList(filters);
              selectVideo(id);
            })();
          }}
        />
      ) : null}
    </div>
  );
}

function FilterToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-500"
      }`}
    >
      {label}
    </button>
  );
}
