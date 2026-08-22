"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MediaRightsWriteInput } from "@magazine/domain";
import type { MediaLibraryQuery } from "@/lib/media/params";
import { MEDIA_LIBRARY_SORT } from "@/lib/media/constants";
import {
  formatDimensions,
  formatMediaTimestamp,
  LICENSE_EXPIRY_SIGNAL_LABELS,
  MEDIA_TYPE_LABELS,
  presentLicenseExpirySignal,
  presentPublicEligibilityBlockedLabel,
} from "@/lib/media/presentation";
import { MediaRightsStatusBadge } from "./media-rights-status-badge";
import {
  MediaInspector,
  MediaInspectorPlaceholder,
  type InspectorData,
} from "./media-inspector";
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
  sourceName: string | null;
  creditLine: string | null;
  licenseExpiresAt: string | null;
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

function hasActiveFilters(filters: MediaLibraryQuery): boolean {
  return Boolean(
    filters.q ||
      filters.type ||
      filters.rightsStatus ||
      filters.missingCredit ||
      filters.missingAltText ||
      filters.used ||
      filters.unused,
  );
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const searchInput = debouncedSearch ?? filters.q ?? "";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filtersActive = hasActiveFilters(filters);

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

  function clearAllFilters() {
    const params = new URLSearchParams();
    if (effectiveSelectedId) {
      params.set("selected", effectiveSelectedId);
    }
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

  const showEmptyLibrary =
    !listLoading && items.length === 0 && !filtersActive && !listError;
  const showFilteredEmpty =
    !listLoading && items.length === 0 && filtersActive && !listError;

  return (
    <div className="mx-auto min-w-0 max-w-[1600px] overflow-x-hidden px-4 py-5 sm:px-6 lg:py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-magenta">
            Varlık yönetimi
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-[1.75rem]">
            Medya Kütüphanesi
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-zinc-600">
            Görselleri, kullanım haklarını ve yayın uygunluğunu yönetin.
          </p>
          {summary ? (
            <p className="mt-2 text-sm text-zinc-500">
              {totalCount} varlık · {summary.eligible} kullanıma uygun ·{" "}
              {summary.incomplete} eksik hak · {summary.restricted} kısıtlı ·{" "}
              {summary.expired} süresi dolmuş
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex h-9 shrink-0 items-center rounded bg-brand-magenta px-4 text-sm font-medium text-white hover:bg-brand-magenta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
          >
            + Medya Yükle
          </button>
        ) : null}
      </div>

      <div
        className="mt-5 rounded border border-zinc-200 bg-white shadow-sm shadow-zinc-200/40"
        aria-busy={listLoading}
      >
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-3 py-3 lg:flex-row lg:items-center">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Medya ara</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Dosya, üretici, hak sahibi, kaynak, kredi…"
              className="h-9 w-full min-w-0 rounded border border-zinc-300 px-3 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700"
              aria-label="Medya ara"
            />
          </label>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 lg:hidden"
            onClick={() => setMobileFiltersOpen((open) => !open)}
            aria-expanded={mobileFiltersOpen}
          >
            Filtreler
          </button>
          <div className="hidden min-w-0 flex-wrap items-center gap-2 lg:flex">
            <FilterControls filters={filters} onUpdate={updateParams} />
          </div>
        </div>
        {mobileFiltersOpen ? (
          <div className="border-b border-zinc-100 px-3 py-3 lg:hidden">
            <FilterControls filters={filters} onUpdate={updateParams} stacked />
            {filtersActive ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-2 text-sm font-medium text-zinc-600 hover:text-zinc-950"
              >
                Filtreleri temizle
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 px-3 py-2.5">
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
          {filtersActive ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="rounded-full px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Temizle
            </button>
          ) : null}
        </div>
      </div>

      {listError ? (
        <p className="mt-4 text-sm text-rose-700" role="alert">{listError}</p>
      ) : null}

      {showEmptyLibrary ? (
        <div className="mt-6 rounded border border-zinc-200 bg-white px-4 py-10 text-center shadow-sm shadow-zinc-200/40">
          <p className="text-sm font-medium text-zinc-900">
            Henüz medya yüklenmedi.
          </p>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="mt-4 inline-flex h-9 items-center rounded bg-brand-magenta px-4 text-sm font-medium text-white hover:bg-brand-magenta-hover"
            >
              Medya Yükle
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
          <section aria-label="Medya listesi" className="min-w-0">
            {listLoading && items.length === 0 ? (
              <p className="text-sm text-zinc-500">Medya listesi yükleniyor…</p>
            ) : null}
            {showFilteredEmpty ? (
              <p className="rounded border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
                Arama veya filtrelerinize uygun medya bulunamadı.
              </p>
            ) : null}
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {items.map((item) => (
                <MediaAssetCard
                  key={item.id}
                  item={item}
                  selected={item.id === effectiveSelectedId}
                  onSelect={() => selectMedia(item.id)}
                />
              ))}
            </ul>
            {nextCursor ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => fetchList(filters, nextCursor, { append: true })}
                  disabled={listLoading}
                  className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60"
                >
                  Daha fazla yükle
                </button>
              </div>
            ) : null}
          </section>

          <aside
            className="hidden min-h-[480px] min-w-0 overflow-hidden rounded border border-zinc-200 bg-white shadow-sm shadow-zinc-200/40 lg:block"
            aria-label="Medya inceleyici"
          >
            {effectiveSelectedId ? (
              <MediaInspector
                data={inspector}
                loading={inspectorLoading}
                error={inspectorError}
                canEdit={canEdit}
                saveState={saveState}
                saveError={saveError}
                onSaveRights={handleSaveRights}
              />
            ) : (
              <MediaInspectorPlaceholder />
            )}
          </aside>
        </div>
      )}

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

function FilterControls({
  filters,
  onUpdate,
  stacked = false,
}: {
  filters: MediaLibraryQuery;
  onUpdate: (updates: Record<string, string | null>) => void;
  stacked?: boolean;
}) {
  const layout = stacked
    ? "grid min-w-0 gap-2"
    : "flex min-w-0 flex-wrap items-center gap-2";

  return (
    <div className={layout}>
      <select
        aria-label="Medya türü filtresi"
        className="h-9 min-w-0 rounded border border-zinc-300 bg-white px-2.5 text-sm"
        value={filters.type ?? ""}
        onChange={(event) => onUpdate({ type: event.target.value || null })}
      >
        <option value="">Tüm türler</option>
        <option value="IMAGE">Görsel</option>
        <option value="VIDEO">Video</option>
        <option value="AUDIO">Ses</option>
      </select>
      <select
        aria-label="Hak durumu filtresi"
        className="h-9 min-w-0 rounded border border-zinc-300 bg-white px-2.5 text-sm"
        value={filters.rightsStatus ?? ""}
        onChange={(event) =>
          onUpdate({ rightsStatus: event.target.value || null })
        }
      >
        <option value="">Tüm hak durumları</option>
        <option value="CLEARED">Kullanıma uygun</option>
        <option value="INCOMPLETE">Hak bilgisi eksik</option>
        <option value="RESTRICTED">Kullanım kısıtlı</option>
        <option value="EXPIRED">Lisans süresi dolmuş</option>
        <option value="NOT_STARTED">Lisans başlamadı</option>
      </select>
      <select
        aria-label="Sıralama"
        className="h-9 min-w-0 rounded border border-zinc-300 bg-white px-2.5 text-sm"
        value={filters.sort}
        onChange={(event) => onUpdate({ sort: event.target.value })}
      >
        <option value={MEDIA_LIBRARY_SORT.CREATED_DESC}>En yeni</option>
        <option value={MEDIA_LIBRARY_SORT.CREATED_ASC}>En eski</option>
        <option value={MEDIA_LIBRARY_SORT.FILENAME_ASC}>Dosya adı (A–Z)</option>
        <option value={MEDIA_LIBRARY_SORT.FILENAME_DESC}>Dosya adı (Z–A)</option>
        <option value={MEDIA_LIBRARY_SORT.EXPIRES_ASC}>
          Lisans bitişi (yakın)
        </option>
      </select>
    </div>
  );
}

function MediaAssetCard({
  item,
  selected,
  onSelect,
}: {
  item: ListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const dimensions = formatDimensions(item.width, item.height);
  const expirySignal = presentLicenseExpirySignal(item.licenseExpiresAt);
  const blockedLabel = presentPublicEligibilityBlockedLabel(
    item.eligibility.eligible,
  );

  return (
    <li className="min-w-0 list-none">
      <button
        type="button"
        onClick={onSelect}
        className={`group flex w-full min-w-0 flex-col overflow-hidden rounded border bg-white text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta ${
          selected
            ? "border-brand-magenta ring-1 ring-brand-magenta"
            : "border-zinc-200 hover:border-zinc-300"
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
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-500">
              Önizleme yok
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-1 p-2">
          <p className="truncate text-xs font-semibold text-zinc-950">
            {item.label}
          </p>
          <p className="text-[10px] text-zinc-500">
            {MEDIA_TYPE_LABELS[item.mediaType as keyof typeof MEDIA_TYPE_LABELS] ??
              item.mediaType}
            {dimensions ? ` · ${dimensions}` : ""}
          </p>
          {item.creditLine ? (
            <p className="truncate text-[10px] text-zinc-600">{item.creditLine}</p>
          ) : null}
          {item.sourceName ? (
            <p className="truncate text-[10px] text-zinc-500">{item.sourceName}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1">
            <MediaRightsStatusBadge
              status={item.eligibility.status}
              eligible={item.eligibility.eligible}
              compact
            />
            {blockedLabel ? (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700">
                {blockedLabel}
              </span>
            ) : null}
            {expirySignal &&
            item.eligibility.status !== "EXPIRED" &&
            expirySignal !== "expired" ? (
              <LicenseExpirySignalBadge signal={expirySignal} />
            ) : null}
          </div>
          <p className="text-[10px] tabular-nums text-zinc-400">
            {formatMediaTimestamp(item.createdAt)}
            {item.usageCount > 0 ? ` · ${item.usageCount} kullanım` : ""}
          </p>
        </div>
      </button>
    </li>
  );
}

function LicenseExpirySignalBadge({
  signal,
}: {
  signal: Exclude<ReturnType<typeof presentLicenseExpirySignal>, null>;
}) {
  const label = LICENSE_EXPIRY_SIGNAL_LABELS[signal];
  const tone =
    signal === "within_7_days"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-amber-100 bg-amber-50/80 text-amber-900";

  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${tone}`}
    >
      {label}
    </span>
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
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
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
