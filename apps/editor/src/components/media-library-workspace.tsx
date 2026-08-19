"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MediaRightsWriteInput } from "@magazine/domain";
import type { MediaLibraryQuery } from "@/lib/media/params";
import { MEDIA_LIBRARY_SORT } from "@/lib/media/constants";
import { formatDimensions, MEDIA_TYPE_LABELS } from "@/lib/media/presentation";
import { MediaRightsStatusBadge } from "./media-rights-status-badge";
import { MediaInspector, type InspectorData } from "./media-inspector";
import { MediaUploadDialog } from "./media-upload-dialog";

type ListItem = {
  id: string;
  label: string;
  mediaType: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  previewUrl: string | null;
  creatorName: string | null;
  creditLine: string | null;
  eligibility: InspectorData["eligibility"];
  usageCount: number;
  createdAt: string;
};

type ListResponse = {
  items: ListItem[];
  nextCursor: string | null;
  totalCount: number;
  summary: {
    total: number;
    eligible: number;
    incomplete: number;
    restricted: number;
    expired: number;
  };
};

const DEBOUNCE_MS = 300;

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string };
};

function readApiData<T>(response: Response, raw: string, fallback: string): T {
  const payload = (raw ? JSON.parse(raw) : {}) as ApiEnvelope<T>;
  if (!response.ok || payload.ok === false || payload.data === undefined) {
    throw new Error(payload.error?.message ?? fallback);
  }
  return payload.data;
}

function filtersToApiSearchParams(
  filters: MediaLibraryQuery,
  cursor?: string | null,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.type) {
    params.set("type", filters.type);
  }
  if (filters.rightsStatus) {
    params.set("rightsStatus", filters.rightsStatus);
  }
  if (filters.missingCredit) {
    params.set("missingCredit", "1");
  }
  if (filters.missingAltText) {
    params.set("missingAltText", "1");
  }
  if (filters.used) {
    params.set("used", "1");
  }
  if (filters.unused) {
    params.set("unused", "1");
  }
  if (filters.sort !== MEDIA_LIBRARY_SORT.CREATED_DESC) {
    params.set("sort", filters.sort);
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  if (filters.pageSize) {
    params.set("pageSize", String(filters.pageSize));
  }
  return params;
}

type MediaLibraryWorkspaceProps = {
  canEdit: boolean;
  filters: MediaLibraryQuery;
  selectedId: string | null;
};

export function MediaLibraryWorkspace({
  canEdit,
  filters,
  selectedId: selectedIdFromPage,
}: MediaLibraryWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ListItem[]>([]);
  const [summary, setSummary] = useState<ListResponse["summary"] | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const activeSelectedId = selectedIdFromPage;
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(null);
  const effectiveSelectedId = activeSelectedId ?? pendingSelectedId;
  const [inspector, setInspector] = useState<InspectorData | null>(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorError, setInspectorError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const searchInput = debouncedSearch ?? filters.q ?? "";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchList = useCallback(
    async (
      listFilters: MediaLibraryQuery,
      cursor?: string | null,
      options?: { append?: boolean },
    ) => {
      if (!options?.append) {
        setListLoading(true);
      }
      setListError(null);
      try {
        const params = filtersToApiSearchParams(listFilters, cursor);
        const response = await fetch(`/api/media?${params.toString()}`, {
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
        setSummary(payload.summary);
        setTotalCount(payload.totalCount);
        setNextCursor(payload.nextCursor);
      } catch (error) {
        setListError(
          error instanceof Error ? error.message : "Liste yüklenemedi.",
        );
      } finally {
        setListLoading(false);
      }
    },
    [],
  );

  const loadInspector = useCallback(async (mediaId: string) => {
    setInspectorLoading(true);
    setInspectorError(null);
    setSaveState("idle");
    setSaveError(null);
    try {
      const response = await fetch(`/api/media/${mediaId}`, { cache: "no-store" });
      const raw = await response.text();
      const payload = readApiData<InspectorData>(
        response,
        raw,
        "Detay yüklenemedi.",
      );
      setInspector(payload);
    } catch (error) {
      setInspector(null);
      setInspectorError(
        error instanceof Error ? error.message : "Detay yüklenemedi.",
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

  function clearSelection() {
    setPendingSelectedId(null);
    setInspector(null);
    setInspectorError(null);
    setMobileInspectorOpen(false);
    updateParams({ selected: null });
  }

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
    router.replace(`/media?${params.toString()}`);
  }

  function selectMedia(id: string) {
    setPendingSelectedId(id);
    setMobileInspectorOpen(true);
    updateParams({ selected: id });
    void loadInspector(id);
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

  async function handleSaveRights(rights: MediaRightsWriteInput) {
    if (!effectiveSelectedId) {
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      const response = await fetch(`/api/media/${effectiveSelectedId}/rights`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rights),
      });
      const raw = await response.text();
      const payload = readApiData<InspectorData>(
        response,
        raw,
        "Kayıt başarısız.",
      );
      setInspector(payload);
      setSaveState("saved");
      await fetchList(filters, undefined, { append: false });
    } catch (error) {
      setSaveState("error");
      setSaveError(
        error instanceof Error ? error.message : "Kayıt başarısız.",
      );
    }
  }

  const emptyState =
    !listLoading && items.length === 0
      ? filters.q || filters.rightsStatus
        ? "Arama veya filtrelerinize uygun medya bulunamadı."
        : "Henüz medya yok."
      : null;

  return (
    <div className="mx-auto min-w-0 max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Medya</h1>
          {summary ? (
            <p className="mt-1 text-sm text-zinc-600">
              {totalCount} varlık · bu sayfada {summary.eligible} uygun,{" "}
              {summary.incomplete} eksik hak, {summary.restricted} kısıtlı,{" "}
              {summary.expired} süresi dolmuş
            </p>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="mt-3 rounded bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
            >
              Medya yükle
            </button>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="min-w-0 text-sm sm:flex-1">
            <span className="sr-only">Ara</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Dosya, üretici, hak sahibi, kaynak, kredi…"
              className="w-full min-w-0 rounded border border-zinc-300 px-3 py-2 sm:max-w-xs"
              aria-label="Medya ara"
            />
          </label>
          <select
            aria-label="Medya türü filtresi"
            className="min-w-0 rounded border border-zinc-300 px-3 py-2 text-sm"
            value={filters.type ?? ""}
            onChange={(event) =>
              updateParams({ type: event.target.value || null })
            }
          >
            <option value="">Tüm türler</option>
            <option value="IMAGE">Görsel</option>
            <option value="VIDEO">Video</option>
            <option value="AUDIO">Ses</option>
          </select>
          <select
            aria-label="Hak durumu filtresi"
            className="min-w-0 rounded border border-zinc-300 px-3 py-2 text-sm"
            value={filters.rightsStatus ?? ""}
            onChange={(event) =>
              updateParams({ rightsStatus: event.target.value || null })
            }
          >
            <option value="">Tüm hak durumları</option>
            <option value="CLEARED">Kullanıma uygun</option>
            <option value="INCOMPLETE">Hak bilgisi eksik</option>
            <option value="RESTRICTED">Kısıtlı</option>
            <option value="EXPIRED">Süresi dolmuş</option>
            <option value="NOT_STARTED">Lisans başlamadı</option>
          </select>
          <select
            aria-label="Sıralama"
            className="min-w-0 rounded border border-zinc-300 px-3 py-2 text-sm"
            value={filters.sort}
            onChange={(event) => updateParams({ sort: event.target.value })}
          >
            <option value={MEDIA_LIBRARY_SORT.CREATED_DESC}>En yeni</option>
            <option value={MEDIA_LIBRARY_SORT.CREATED_ASC}>En eski</option>
            <option value={MEDIA_LIBRARY_SORT.FILENAME_ASC}>Dosya adı (A–Z)</option>
            <option value={MEDIA_LIBRARY_SORT.FILENAME_DESC}>Dosya adı (Z–A)</option>
            <option value={MEDIA_LIBRARY_SORT.EXPIRES_ASC}>Lisans bitişi (yakın)</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <FilterToggle
          label="Eksik kredi"
          active={filters.missingCredit === true}
          onClick={() =>
            updateParams({
              missingCredit: filters.missingCredit ? null : "1",
            })
          }
        />
        <FilterToggle
          label="Eksik alt metin"
          active={filters.missingAltText === true}
          onClick={() =>
            updateParams({
              missingAltText: filters.missingAltText ? null : "1",
            })
          }
        />
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
        <p className="mt-4 text-sm text-rose-700" role="alert">{listError}</p>
      ) : null}

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <section aria-label="Medya listesi" className="min-w-0">
          {listLoading && items.length === 0 ? (
            <p className="text-sm text-zinc-500">Medya listesi yükleniyor…</p>
          ) : null}
          {emptyState ? (
            <p className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
              {emptyState}
            </p>
          ) : null}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {items.map((item) => {
              const selected = item.id === effectiveSelectedId;
              const dimensions = formatDimensions(item.width, item.height);
              return (
                <li key={item.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => selectMedia(item.id)}
                    className={`group flex w-full min-w-0 flex-col overflow-hidden rounded-lg border bg-white text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 ${
                      selected
                        ? "border-zinc-900 ring-1 ring-zinc-900"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                    aria-pressed={selected}
                    aria-label={`${item.label} — ${MEDIA_TYPE_LABELS[item.mediaType as keyof typeof MEDIA_TYPE_LABELS] ?? item.mediaType}`}
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-zinc-100">
                      {item.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.previewUrl}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                          Önizleme yok
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1 p-2">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-zinc-500">
                        {MEDIA_TYPE_LABELS[item.mediaType as keyof typeof MEDIA_TYPE_LABELS] ??
                          item.mediaType}
                        {dimensions ? ` · ${dimensions}` : ""}
                      </p>
                      <div className="flex flex-wrap items-center gap-1">
                        <MediaRightsStatusBadge
                          status={item.eligibility.status}
                          eligible={item.eligibility.eligible}
                          compact
                        />
                        {item.usageCount > 0 ? (
                          <span className="text-xs text-zinc-500">
                            {item.usageCount} kullanım
                          </span>
                        ) : null}
                      </div>
                      {item.creatorName ? (
                        <p className="truncate text-xs text-zinc-500">
                          {item.creatorName}
                        </p>
                      ) : null}
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
                onClick={() => fetchList(filters, nextCursor, { append: true })}
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
          aria-label="Medya inceleyici"
        >
          <MediaInspector
            data={inspector}
            loading={inspectorLoading}
            error={inspectorError}
            canEdit={canEdit}
            saveState={saveState}
            saveError={saveError}
            onSaveRights={handleSaveRights}
          />
        </aside>
      </div>

      {mobileInspectorOpen && effectiveSelectedId ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          role="presentation"
          onClick={() => clearSelection()}
        >
          <div
            className="absolute inset-x-0 bottom-0 top-12 max-w-full overflow-hidden rounded-t-xl bg-white"
            role="dialog"
            aria-modal="true"
            aria-label="Medya detayı"
            onClick={(event) => event.stopPropagation()}
          >
            <MediaInspector
              data={inspector}
              loading={inspectorLoading}
              error={inspectorError}
              canEdit={canEdit}
              saveState={saveState}
              saveError={saveError}
              onSaveRights={handleSaveRights}
              onClose={() => clearSelection()}
            />
          </div>
        </div>
      ) : null}
      {canEdit ? (
        <MediaUploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          onUploaded={(item) => {
            void (async () => {
              await fetchList(filters);
              selectMedia(item.id);
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
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
