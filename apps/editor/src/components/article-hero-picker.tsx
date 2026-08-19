"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ARTICLE_HERO_ALT_TEXT_MAX,
  MEDIA_RIGHTS_STATUS,
  MEDIA_RIGHTS_TEXT_MAX,
  MEDIA_TYPE,
  type MediaPublicIneligibilityReason,
  type MediaRightsStatus,
} from "@magazine/domain";
import {
  formatDimensions,
  INELIGIBILITY_REASON_LABELS,
} from "@/lib/media/presentation";
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

type PickerDetail = {
  id: string;
  label: string;
  width: number | null;
  height: number | null;
  previewUrl: string | null;
  creatorName: string | null;
  creditLine: string | null;
  eligibility: PickerItem["eligibility"];
  rights?: {
    licenseExpiresAt?: string | null;
  };
};

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string };
};

type ArticleHeroPickerProps = {
  open: boolean;
  initialHero: ArticleEditorMedia | null;
  disabled: boolean;
  onClose: () => void;
  onConfirm: (next: {
    media: PickerItem;
    altText: string;
    credit: string;
  }) => void;
};

function readApiData<T>(response: Response, raw: string, fallback: string): T {
  const payload = (raw ? JSON.parse(raw) : {}) as ApiEnvelope<T>;
  if (!response.ok || payload.ok === false || payload.data === undefined) {
    throw new Error(payload.error?.message ?? fallback);
  }
  return payload.data;
}

function detailFromHero(hero: ArticleEditorMedia | null): PickerDetail | null {
  if (!hero) {
    return null;
  }
  return {
    id: hero.id,
    label: hero.label,
    width: hero.width,
    height: hero.height,
    previewUrl: hero.previewUrl ?? null,
    creatorName: hero.creatorName ?? null,
    creditLine: hero.creditLine ?? null,
    eligibility: hero.eligibility ?? {
      eligible: false,
      status: MEDIA_RIGHTS_STATUS.INCOMPLETE,
      reasons: [],
    },
  };
}
function statusLabel(item: { eligibility: PickerItem["eligibility"] }): string {
  if (item.eligibility.eligible) {
    return "Haklar uygun";
  }
  return "Hak uyarısı var; seçilebilir (yayını engellemez).";
}

export function ArticleHeroPicker({
  open,
  initialHero,
  disabled,
  onClose,
  onConfirm,
}: ArticleHeroPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchId = useId();
  const listId = useId();
  const statusId = useId();
  const altId = useId();
  const creditId = useId();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<PickerItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialHero?.id ?? null,
  );
  const [detail, setDetail] = useState<PickerDetail | null>(
    detailFromHero(initialHero),
  );
  const [detailError, setDetailError] = useState<string | null>(null);
  const [altText, setAltText] = useState(initialHero?.altText ?? "");
  const [credit, setCredit] = useState(initialHero?.credit ?? "");

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

  useEffect(() => {
    if (!open || !selectedId) {
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/media/${selectedId}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const raw = await response.text();
        const data = readApiData<PickerDetail>(
          response,
          raw,
          "Medya ayrıntısı yüklenemedi.",
        );
        if (controller.signal.aborted) {
          return;
        }
        setDetail({
          id: data.id,
          label: data.label,
          width: data.width,
          height: data.height,
          previewUrl: data.previewUrl,
          creatorName: data.creatorName,
          creditLine: data.creditLine,
          eligibility: data.eligibility,
          rights: data.rights
            ? { licenseExpiresAt: data.rights.licenseExpiresAt ?? null }
            : undefined,
        });
        setDetailError(null);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setDetailError(
          caught instanceof Error ? caught.message : "Medya ayrıntısı yüklenemedi.",
        );
      });
    return () => controller.abort();
  }, [open, selectedId]);

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

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedDetail = detail?.id === selectedId ? detail : selected;
  const confirmItem =
    selected ??
    (selectedDetail && selectedDetail.id === selectedId
      ? {
          id: selectedDetail.id,
          label: selectedDetail.label,
          mediaType: MEDIA_TYPE.IMAGE,
          width: selectedDetail.width,
          height: selectedDetail.height,
          previewUrl: selectedDetail.previewUrl,
          creatorName: selectedDetail.creatorName,
          creditLine: selectedDetail.creditLine,
          eligibility: selectedDetail.eligibility,
        }
      : null);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="article-hero-picker-title"
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
              id="article-hero-picker-title"
              className="text-base font-semibold"
            >
              Kapak görseli seç
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Yalnızca görseller seçilebilir. Hak uyarıları bilgilendirme içindir;
              yayını engellemez.
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

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-h-0 overflow-y-auto px-4 py-3">
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
              {loading ? "Medya yükleniyor" : error ?? `${items.length} görsel`}
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
                id={listId}
                className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
                role="listbox"
                aria-label="Kapak görselleri"
              >
                {items.map((item) => {
                  const selectedCard = item.id === selectedId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selectedCard}
                        onClick={() => {
                          setSelectedId(item.id);
                          setDetail(item);
                        }}
                        className={`flex w-full flex-col overflow-hidden rounded border text-left focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                          selectedCard
                            ? "border-zinc-900 ring-2 ring-zinc-900"
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
                        </span>
                        <span className="flex items-start justify-between gap-1 px-2 py-1.5">
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium text-zinc-900">
                              {item.label}
                            </span>
                            {selectedCard ? (
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

          <aside className="min-h-0 overflow-y-auto border-t border-zinc-200 px-4 py-3 lg:border-l lg:border-t-0">
            {selectedDetail ? (
              <div className="space-y-3">
                <div className="aspect-[3/2] overflow-hidden rounded bg-zinc-100">
                  {selectedDetail.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedDetail.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <p className="flex h-full items-center justify-center text-xs text-zinc-500">
                      Önizleme yok
                    </p>
                  )}
                </div>
                <p className="text-sm font-medium text-zinc-950">
                  {selectedDetail.label}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatDimensions(selectedDetail.width, selectedDetail.height) ??
                    "Boyut yok"}
                </p>
                {selectedDetail.creatorName ? (
                  <p className="text-xs text-zinc-600">
                    Fotoğrafçı / üretici: {selectedDetail.creatorName}
                  </p>
                ) : null}
                <p className="text-xs text-zinc-600">
                  Medya kredisi: {selectedDetail.creditLine ?? "Yok"}
                </p>
                <MediaRightsStatusBadge
                  status={
                    (selectedDetail.eligibility.status as MediaRightsStatus) ??
                    MEDIA_RIGHTS_STATUS.INCOMPLETE
                  }
                  eligible={selectedDetail.eligibility.eligible}
                />
                <p className="text-xs text-zinc-600">{statusLabel(selectedDetail)}</p>
                {selectedDetail.eligibility.reasons.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-4 text-xs text-amber-900">
                    {selectedDetail.eligibility.reasons.map((reason) => (
                      <li key={reason}>
                        {INELIGIBILITY_REASON_LABELS[
                          reason as MediaPublicIneligibilityReason
                        ] ?? reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {selectedDetail && "rights" in selectedDetail && selectedDetail.rights?.licenseExpiresAt ? (
                  <p className="text-xs text-zinc-500">
                    Lisans bitişi:{" "}
                    {new Date(selectedDetail.rights.licenseExpiresAt).toLocaleString(
                      "tr-TR",
                    )}
                  </p>
                ) : null}
                {detailError ? (
                  <p className="text-xs text-red-700">{detailError}</p>
                ) : null}

                <div>
                  <label htmlFor={altId} className="block text-sm font-medium text-zinc-700">
                    Bu habere özel alt metin
                  </label>
                  <textarea
                    id={altId}
                    rows={3}
                    maxLength={ARTICLE_HERO_ALT_TEXT_MAX}
                    value={altText}
                    onChange={(event) => setAltText(event.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Dosya adını kopyalamayın. En fazla {ARTICLE_HERO_ALT_TEXT_MAX} karakter.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor={creditId}
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Habere özel kredi (isteğe bağlı)
                  </label>
                  <input
                    id={creditId}
                    maxLength={MEDIA_RIGHTS_TEXT_MAX.CREDIT}
                    value={credit}
                    onChange={(event) => setCredit(event.target.value)}
                    className="mt-1 h-9 w-full rounded border border-zinc-300 px-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Boş bırakılırsa yayında medyanın kredi satırı kullanılır. İç
                    hak notları kopyalanmaz.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Bir görsel seçin.</p>
            )}
          </aside>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!confirmItem || disabled}
            onClick={() => {
              if (!confirmItem) {
                return;
              }
              onConfirm({ media: confirmItem, altText, credit });
            }}
            className="h-9 rounded bg-zinc-950 px-3 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            Kapak olarak kullan
          </button>
        </div>
      </div>
    </dialog>
  );
}
