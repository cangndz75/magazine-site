"use client";

import { useCallback, useMemo, useState } from "react";
import type { HomepageBuilderView, HomepageStorySummary } from "@/lib/homepage/builder-types";
import type { ContentPoolItem } from "./homepage-builder-content-pool";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string };

type Props = {
  builder: HomepageBuilderView;
  onBuilderChange: (builder: HomepageBuilderView) => void;
  disabled?: boolean;
};

type ConversationResponse = {
  ok?: boolean;
  data?: { builder: HomepageBuilderView };
  error?: { code?: string; message?: string };
};

const CONFLICT_CODES = new Set(["WRITE_CONFLICT"]);

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Bilinmiyor";
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function storyTitle(story: HomepageStorySummary | undefined): string {
  return story?.title?.trim() || "Bağlı haber yok";
}

function conversationErrorMessage(code: string | undefined, fallback?: string): string {
  switch (code) {
    case "LIMIT_EXCEEDED":
      return "En fazla 5 başlık eklenebilir.";
    case "DUPLICATE_CONTENT_ITEM":
      return "Aynı haber listeye iki kez eklenemez.";
    case "INVALID_LABEL":
      return "Başlık 1-80 karakter olmalı.";
    case "INVALID_REASON":
      return "Bağlam metni en fazla 200 karakter olmalı.";
    case "INVALID_CONTENT_ITEM":
      return "Seçilen haber bulunamadı.";
    case "WRITE_CONFLICT":
      return "Bu liste başka bir oturumda güncellendi. Yenileyip tekrar deneyin.";
    case "ITEM_NOT_FOUND":
      return "Konuşulan başlık bulunamadı.";
    case "INVALID_REORDER":
      return "Sıralama isteği geçersiz.";
    default:
      return fallback || "İşlem tamamlanamadı. Tekrar deneyin.";
  }
}

async function parseConversationResponse(response: Response): Promise<HomepageBuilderView> {
  const json = (await response.json()) as ConversationResponse;
  if (!response.ok || !json.ok || !json.data?.builder) {
    const message = conversationErrorMessage(json.error?.code, json.error?.message);
    const error = new Error(message);
    error.name = CONFLICT_CODES.has(json.error?.code ?? "") ? "ConflictError" : "Error";
    throw error;
  }
  return json.data.builder;
}

export function HomepageConversationManager({
  builder,
  onBuilderChange,
  disabled = false,
}: Props) {
  const [label, setLabel] = useState("");
  const [reason, setReason] = useState("");
  const [contentItemId, setContentItemId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ContentPoolItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  const items = builder.conversation.items;
  const selectedStory = contentItemId ? builder.stories[contentItemId] : undefined;
  const atLimit = items.length >= builder.conversation.maxItems && editingId === null;
  const isBusy = disabled || saveState.kind === "saving";

  const linkedIds = useMemo(
    () =>
      new Set(
        items
          .filter((item) => item.id !== editingId)
          .map((item) => item.contentItemId)
          .filter((id): id is string => id !== null),
      ),
    [editingId, items],
  );

  const resetForm = useCallback(() => {
    setLabel("");
    setReason("");
    setContentItemId(null);
    setIsActive(true);
    setEditingId(null);
    setExpectedUpdatedAt(null);
    setSearch("");
    setSearchResults([]);
  }, []);

  const applyBuilder = useCallback(
    (next: HomepageBuilderView) => {
      onBuilderChange(next);
      setSaveState({ kind: "saved" });
    },
    [onBuilderChange],
  );

  const requestMutation = useCallback(
    async (path: string, init: RequestInit) => {
      setSaveState({ kind: "saving" });
      try {
        const response = await fetch(path, {
          ...init,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
          },
        });
        const next = await parseConversationResponse(response);
        applyBuilder(next);
        return true;
      } catch (error) {
        setSaveState({
          kind: error instanceof Error && error.name === "ConflictError" ? "conflict" : "error",
          message: error instanceof Error ? error.message : "İşlem tamamlanamadı.",
        });
        return false;
      }
    },
    [applyBuilder],
  );

  const searchPublishedArticles = useCallback(async () => {
    const query = search.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({
        limit: "10",
        publicationStatus: "PUBLISHED",
        q: query,
      });
      const response = await fetch(`/api/content?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const json = (await response.json()) as {
        ok?: boolean;
        data?: { items: ContentPoolItem[] };
      };
      if (!response.ok || !json.ok || !json.data) {
        throw new Error("search_failed");
      }
      setSearchResults(
        json.data.items.filter((item) => item.publicationStatus === "PUBLISHED"),
      );
    } catch {
      setSearchResults([]);
      setSaveState({
        kind: "error",
        message: "Haber araması yüklenemedi.",
      });
    } finally {
      setSearching(false);
    }
  }, [search]);

  const submitForm = useCallback(async () => {
    if (atLimit || !label.trim()) {
      return;
    }
    const body =
      editingId && expectedUpdatedAt
        ? {
            id: editingId,
            expectedUpdatedAt,
            label,
            reason,
            contentItemId,
            isActive,
          }
        : {
            label,
            reason,
            contentItemId,
            isActive,
          };
    const ok = await requestMutation("/api/homepage/conversation", {
      method: editingId ? "PATCH" : "POST",
      body: JSON.stringify(body),
    });
    if (ok) {
      resetForm();
    }
  }, [
    atLimit,
    contentItemId,
    editingId,
    expectedUpdatedAt,
    isActive,
    label,
    reason,
    requestMutation,
    resetForm,
  ]);

  const editItem = useCallback(
    (id: string) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) {
        return;
      }
      setEditingId(item.id);
      setExpectedUpdatedAt(item.updatedAt);
      setLabel(item.label);
      setReason(item.reason ?? "");
      setContentItemId(item.contentItemId);
      setIsActive(item.isActive);
      setSaveState({ kind: "idle" });
    },
    [items],
  );

  const removeItem = useCallback(
    async (id: string) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) {
        return;
      }
      const ok = await requestMutation("/api/homepage/conversation", {
        method: "DELETE",
        body: JSON.stringify({
          id: item.id,
          expectedUpdatedAt: item.updatedAt,
        }),
      });
      if (ok && editingId === id) {
        resetForm();
      }
    },
    [editingId, items, requestMutation, resetForm],
  );

  const moveItem = useCallback(
    async (id: string, direction: "up" | "down") => {
      const index = items.findIndex((item) => item.id === id);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || targetIndex >= items.length) {
        return;
      }
      const orderedIds = items.map((item) => item.id);
      const [moved] = orderedIds.splice(index, 1);
      orderedIds.splice(targetIndex, 0, moved);
      await requestMutation("/api/homepage/conversation/reorder", {
        method: "POST",
        body: JSON.stringify({
          expectedUpdatedAt: builder.conversation.updatedAt,
          orderedIds,
        }),
      });
    },
    [builder.conversation.updatedAt, items, requestMutation],
  );

  return (
    <section
      className="border-t border-zinc-200 bg-white"
      aria-labelledby="homepage-conversation-title"
    >
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-700">
                Ana Sayfa Yönetimi
              </p>
              <h2
                id="homepage-conversation-title"
                className="mt-1 text-lg font-semibold text-zinc-950"
              >
                Şu An Konuşuluyor
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-600">
                Anasayfanın sağ editoryal şeridinde gösterilecek gündem
                başlıklarını yönetin. Kaydedilen değişiklikler anasayfada
                doğrudan yayına alınır.
              </p>
            </div>
            <div className="text-xs text-zinc-600">
              <span className="font-semibold text-zinc-950">{items.length}</span>
              <span> / {builder.conversation.maxItems} başlık</span>
            </div>
          </div>

          {saveState.kind === "conflict" || saveState.kind === "error" ? (
            <div
              className="mt-3 border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              role="alert"
            >
              {saveState.message}
            </div>
          ) : null}

          <div className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              {items.length === 0 ? (
                <div className="border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-sm text-zinc-600">
                  <p className="font-medium text-zinc-900">
                    Şu An Konuşuluyor alanında henüz içerik yok.
                  </p>
                  <p className="mt-1">
                    Başlık eklenene kadar herkese açık sağ şerit gizli kalır.
                  </p>
                </div>
              ) : (
                <ol className="divide-y divide-zinc-200 border border-zinc-200">
                  {items.map((item, index) => {
                    const story = item.contentItemId
                      ? builder.stories[item.contentItemId]
                      : undefined;
                    return (
                      <li key={item.id} className="bg-white px-3 py-3">
                        <div className="grid gap-3 md:grid-cols-[42px_minmax(0,1fr)_auto] md:items-center">
                          <div className="flex items-center">
                            <span className="tabular-nums text-sm font-semibold text-zinc-950">
                              {String(item.rank).padStart(2, "0")}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-zinc-950">
                                {item.label}
                              </p>
                              <span className="text-xs text-zinc-500">
                                {item.isActive ? "Aktif" : "Gizli"}
                              </span>
                            </div>
                            {item.reason ? (
                              <p className="mt-0.5 truncate text-xs text-zinc-600">
                                {item.reason}
                              </p>
                            ) : null}
                            <p className="mt-1 truncate text-xs text-zinc-500">
                              {storyTitle(story)} · Güncel: {formatUpdatedAt(item.updatedAt)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy || index === 0}
                              onClick={() => void moveItem(item.id, "up")}
                              className="border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-40"
                              aria-label={`${item.label} başlığını yukarı taşı`}
                            >
                              Yukarı
                            </button>
                            <button
                              type="button"
                              disabled={isBusy || index === items.length - 1}
                              onClick={() => void moveItem(item.id, "down")}
                              className="border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-40"
                              aria-label={`${item.label} başlığını aşağı taşı`}
                            >
                              Aşağı
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => editItem(item.id)}
                              className="border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                              aria-label={`${item.label} başlığını düzenle`}
                            >
                              Düzenle
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void removeItem(item.id)}
                              className="border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600"
                              aria-label={`${item.label} başlığını çıkar`}
                            >
                              Çıkar
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="text-sm font-semibold text-zinc-950">
                {editingId ? "Başlığı düzenle" : "Başlık ekle"}
              </h3>
              <div className="mt-3 space-y-3">
                <label className="block text-xs font-medium text-zinc-700">
                  Başlık
                  <input
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    disabled={isBusy || atLimit}
                    maxLength={80}
                    className="mt-1 w-full border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </label>
                <label className="block text-xs font-medium text-zinc-700">
                  Bağlam
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    disabled={isBusy || atLimit}
                    maxLength={200}
                    rows={3}
                    className="mt-1 w-full resize-none border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(event) => setIsActive(event.target.checked)}
                    disabled={isBusy || atLimit}
                    className="h-4 w-4"
                  />
                  Public rayda göster
                </label>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">
                    Bağlı yayındaki haber
                    <div className="mt-1 flex gap-2">
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        disabled={isBusy || atLimit}
                        placeholder="Yayındaki haber ara"
                        className="min-w-0 flex-1 border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      />
                      <button
                        type="button"
                        disabled={isBusy || atLimit || searching}
                        onClick={() => void searchPublishedArticles()}
                        className="border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
                      >
                        Ara
                      </button>
                    </div>
                  </label>
                  {contentItemId ? (
                    <div className="mt-2 flex items-center justify-between gap-2 border border-zinc-200 bg-white px-2.5 py-2 text-xs">
                      <span className="min-w-0 truncate text-zinc-700">
                        {storyTitle(selectedStory)}
                      </span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setContentItemId(null)}
                        className="shrink-0 text-zinc-500 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      >
                        Kaldır
                      </button>
                    </div>
                  ) : null}
                  {searchResults.length > 0 ? (
                    <div className="mt-2 max-h-44 overflow-y-auto border border-zinc-200 bg-white">
                      {searchResults.map((item) => {
                        const duplicate = linkedIds.has(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={isBusy || duplicate}
                            onClick={() => {
                              setContentItemId(item.id);
                              setLabel((current) => current || item.displayVersion.title);
                            }}
                            className="block w-full border-b border-zinc-100 px-2.5 py-2 text-left text-xs hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-500 disabled:bg-zinc-50 disabled:text-zinc-400"
                          >
                            <span className="block truncate font-medium">
                              {item.displayVersion.title || "Başlıksız"}
                            </span>
                            <span className="block truncate text-zinc-500">
                              {duplicate ? "Zaten listede" : item.slug}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                {atLimit ? (
                  <p className="text-xs text-amber-700">
                    Liste dolu. Yeni başlık eklemek için önce bir başlığı çıkarın.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isBusy || atLimit || !label.trim()}
                    onClick={() => void submitForm()}
                    className="bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
                  >
                    {editingId ? "Güncelle" : "Ekle"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={resetForm}
                    className="border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  >
                    Temizle
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="border-t border-zinc-200 bg-zinc-950 p-4 text-white xl:border-l xl:border-t-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300">
            Şu An Konuşuluyor
          </p>
          {items.filter((item) => item.isActive).length === 0 ? (
            <p className="mt-4 text-sm text-zinc-300">
              Public önizleme boş. Aktif başlık eklenene kadar şerit gizli kalır.
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {items
                .filter((item) => item.isActive)
                .slice(0, builder.conversation.maxItems)
                .map((item) => (
                  <li key={item.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
                    <span className="text-sm font-semibold text-fuchsia-200">
                      {item.rank}
                    </span>
                    <span className="min-w-0 text-sm font-medium leading-snug">
                      {item.label}
                    </span>
                  </li>
                ))}
            </ol>
          )}
        </aside>
      </div>
    </section>
  );
}
