"use client";

import { useCallback, useMemo, useState } from "react";
import type { HomepageSlotKey } from "@magazine/domain";
import {
  HOMEPAGE_FEATURED_KEYS,
  isHomepageFeaturedSlotKey,
} from "@/lib/homepage/slot-meta";
import type { HomepageBuilderView } from "@/lib/homepage/builder-types";
import {
  countDraftChanges,
  analyzePublishEligibility,
  findSlotForContentItem,
  formatHomepageLivePublishedLabel,
  slotAssignmentLabel,
  type SaveState,
} from "@/lib/homepage/builder-utils";
import {
  isHomepageBuilderConflict,
  presentHomepageBuilderError,
  HOMEPAGE_BUILDER_CONFLICT_MESSAGE,
} from "@/lib/homepage/builder-messages";
import type { ContentPoolCategoryOption } from "./homepage-builder-content-pool";
import { HomepageBuilderComposition } from "./homepage-builder-composition";
import {
  HomepageBuilderContentPool,
  type ContentPoolItem,
} from "./homepage-builder-content-pool";
import { HomepageBuilderInspector } from "./homepage-builder-inspector";
import {
  HomepageConflictBanner,
  HomepagePreviewDialog,
  HomepagePublishDialog,
} from "./homepage-builder-dialogs";
import { HomepageVideoPicker } from "./homepage-video-picker";

type Props = {
  initialBuilder: HomepageBuilderView;
  categoryOptions: ContentPoolCategoryOption[];
  siteUrl: string;
};

export function HomepageBuilderWorkspace({
  initialBuilder,
  categoryOptions,
  siteUrl,
}: Props) {
  const [builder, setBuilder] = useState(initialBuilder);
  const [selectedSlotKey, setSelectedSlotKey] = useState<HomepageSlotKey | null>(
    null,
  );
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [assignTargetSlotKey, setAssignTargetSlotKey] = useState<HomepageSlotKey | null>(
    null,
  );
  const [pendingSlotKey, setPendingSlotKey] = useState<HomepageSlotKey | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [publishOpen, setPublishOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishPending, setPublishPending] = useState(false);
  const [poolOpen, setPoolOpen] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [videoPending, setVideoPending] = useState(false);

  const eligibility = useMemo(() => analyzePublishEligibility(builder), [builder]);
  const draftChanges = useMemo(() => countDraftChanges(builder), [builder]);
  const livePublishedLabel = useMemo(
    () => formatHomepageLivePublishedLabel(builder.published?.publishedAt),
    [builder.published?.publishedAt],
  );
  const isBusy =
    saveState.kind === "saving" || publishPending || pendingSlotKey !== null || videoPending;

  const statusLabel = useMemo(() => {
    if (saveState.kind === "saving") {
      return "Kaydediliyor…";
    }
    if (saveState.kind === "conflict") {
      return "Başka bir kullanıcı değiştirdi";
    }
    if (saveState.kind === "saved") {
      return "Kaydedildi";
    }
    if (saveState.kind === "error") {
      return "Kayıt hatası";
    }
    return "Taslak düzenleniyor";
  }, [saveState]);

  const reloadBuilder = useCallback(async () => {
    const response = await fetch("/api/homepage/builder", {
      headers: { Accept: "application/json" },
    });
    const json = (await response.json()) as {
      ok?: boolean;
      data?: { builder: HomepageBuilderView };
    };
    if (!response.ok || !json.ok || !json.data?.builder) {
      throw new Error("reload_failed");
    }
    setBuilder(json.data.builder);
    setSaveState({ kind: "idle" });
  }, []);

  const mutateSlot = useCallback(
    async (slotKey: HomepageSlotKey, contentItemId: string | null) => {
      if (contentItemId) {
        const existing = findSlotForContentItem(builder.draft, contentItemId);
        if (existing && existing !== slotKey) {
          setSaveState({
            kind: "error",
            message: `Bu haber zaten ${slotAssignmentLabel(existing)} slotunda.`,
          });
          return false;
        }
      }

      setPendingSlotKey(slotKey);
      setSaveState({ kind: "saving" });
      try {
        const response = await fetch("/api/homepage/builder/slots", {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expectedUpdatedAt: builder.updatedAt,
            slotKey,
            contentItemId,
          }),
        });
        const json = (await response.json()) as {
          ok?: boolean;
          data?: { builder: HomepageBuilderView };
          error?: { code?: string };
        };

        if (!response.ok || !json.ok || !json.data?.builder) {
          const code = json.error?.code;
          if (isHomepageBuilderConflict(code)) {
            setSaveState({
              kind: "conflict",
              message: HOMEPAGE_BUILDER_CONFLICT_MESSAGE,
            });
          } else {
            setSaveState({
              kind: "error",
              message: presentHomepageBuilderError(code),
            });
          }
          return false;
        }

        setBuilder(json.data.builder);
        setSaveState({ kind: "saved" });
        return true;
      } catch {
        setSaveState({
          kind: "error",
          message: "Kayıt başarısız. Tekrar deneyin.",
        });
        return false;
      } finally {
        setPendingSlotKey(null);
      }
    },
    [builder],
  );

  const mutateVideo = useCallback(
    async (videoAssetId: string | null) => {
      setVideoPending(true);
      setSaveState({ kind: "saving" });
      try {
        const response = await fetch("/api/homepage/builder/video", {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expectedUpdatedAt: builder.updatedAt,
            videoAssetId,
          }),
        });
        const json = (await response.json()) as {
          ok?: boolean;
          data?: { builder: HomepageBuilderView };
          error?: { code?: string };
        };

        if (!response.ok || !json.ok || !json.data?.builder) {
          const code = json.error?.code;
          if (isHomepageBuilderConflict(code)) {
            setSaveState({
              kind: "conflict",
              message: HOMEPAGE_BUILDER_CONFLICT_MESSAGE,
            });
          } else {
            setSaveState({
              kind: "error",
              message: presentHomepageBuilderError(code),
            });
          }
          return false;
        }

        setBuilder(json.data.builder);
        setSaveState({ kind: "saved" });
        return true;
      } catch {
        setSaveState({
          kind: "error",
          message: "Kayıt başarısız. Tekrar deneyin.",
        });
        return false;
      } finally {
        setVideoPending(false);
      }
    },
    [builder.updatedAt],
  );

  const handleSelectSlot = useCallback((slotKey: HomepageSlotKey) => {
    setSelectedSlotKey(slotKey);
    setAssignTargetSlotKey(slotKey);
    setPoolOpen(true);
  }, []);

  const handleSelectContent = useCallback(
    async (item: ContentPoolItem) => {
      setSelectedContentId(item.id);
      const target = assignTargetSlotKey ?? selectedSlotKey;
      if (!target) {
        setSelectedSlotKey(null);
        return;
      }
      const ok = await mutateSlot(target, item.id);
      if (ok) {
        setSelectedSlotKey(target);
        setAssignTargetSlotKey(target);
      }
    },
    [assignTargetSlotKey, mutateSlot, selectedSlotKey],
  );

  const handleClearSlot = useCallback(
    async (slotKey: HomepageSlotKey) => {
      const ok = await mutateSlot(slotKey, null);
      if (ok) {
        setSelectedSlotKey(slotKey);
      }
    },
    [mutateSlot],
  );

  const handleMoveFeatured = useCallback(
    async (slotKey: HomepageSlotKey, direction: "left" | "right") => {
      if (!isHomepageFeaturedSlotKey(slotKey)) {
        return;
      }
      const index = HOMEPAGE_FEATURED_KEYS.indexOf(slotKey);
      if (index < 0) {
        return;
      }
      const neighborIndex = direction === "left" ? index - 1 : index + 1;
      const neighborKey = HOMEPAGE_FEATURED_KEYS[neighborIndex];
      if (!neighborKey) {
        return;
      }

      const currentId =
        builder.draft.slots.find((slot) => slot.slotKey === slotKey)?.contentItemId ??
        null;
      const neighborId =
        builder.draft.slots.find((slot) => slot.slotKey === neighborKey)?.contentItemId ??
        null;

      if (currentId === neighborId) {
        return;
      }

      setPendingSlotKey(slotKey);
      setSaveState({ kind: "saving" });
      try {
        const response = await fetch("/api/homepage/builder/slots/move", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expectedUpdatedAt: builder.updatedAt,
            slotKey,
            direction,
          }),
        });
        const json = (await response.json()) as {
          ok?: boolean;
          data?: { builder: HomepageBuilderView };
          error?: { code?: string };
        };
        if (!response.ok || !json.ok || !json.data?.builder) {
          const code = json.error?.code;
          if (isHomepageBuilderConflict(code)) {
            setSaveState({
              kind: "conflict",
              message: HOMEPAGE_BUILDER_CONFLICT_MESSAGE,
            });
          } else {
            setSaveState({
              kind: "error",
              message: presentHomepageBuilderError(code),
            });
          }
          return;
        }

        setBuilder(json.data.builder);
        setSaveState({ kind: "saved" });
      } catch {
        setSaveState({
          kind: "error",
          message: "Sıra değiştirilemedi.",
        });
      } finally {
        setPendingSlotKey(null);
      }
    },
    [builder],
  );

  const handlePublish = useCallback(async () => {
    setPublishPending(true);
    try {
      const response = await fetch("/api/homepage/builder/publish", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expectedUpdatedAt: builder.updatedAt }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        data?: { builder: HomepageBuilderView };
        error?: { code?: string };
      };

      if (!response.ok || !json.ok || !json.data?.builder) {
        const code = json.error?.code;
        if (isHomepageBuilderConflict(code)) {
          setSaveState({
            kind: "conflict",
            message: HOMEPAGE_BUILDER_CONFLICT_MESSAGE,
          });
        } else {
          setSaveState({
            kind: "error",
            message: presentHomepageBuilderError(code),
          });
        }
        return;
      }

      setBuilder(json.data.builder);
      setSaveState({ kind: "saved" });
      setPublishOpen(false);
    } catch {
      setSaveState({
        kind: "error",
        message: "Yayınlama başarısız. Tekrar deneyin.",
      });
    } finally {
      setPublishPending(false);
    }
  }, [builder.updatedAt]);

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col">
      {saveState.kind === "conflict" && (
        <HomepageConflictBanner
          message={saveState.message}
          onReload={() => {
            reloadBuilder().catch(() => {
              setSaveState({
                kind: "error",
                message: "Taslak yüklenemedi.",
              });
            });
          }}
        />
      )}

      <header className="border-b border-zinc-200 bg-white px-4 py-3 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">Homepage Builder</h1>
            <p className="text-xs text-zinc-500">{statusLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
            <div className="rounded border border-zinc-200 px-2.5 py-1.5">
              <span className="font-semibold uppercase tracking-wide text-zinc-500">
                Canlı
              </span>
              <span className="ml-2">
                {livePublishedLabel
                  ? `Son yayın: ${livePublishedLabel}`
                  : "Henüz yayınlanmadı"}
              </span>
            </div>
            <div className="rounded border border-zinc-200 px-2.5 py-1.5">
              <span className="font-semibold uppercase tracking-wide text-zinc-500">
                Taslak
              </span>
              <span className="ml-2">
                {draftChanges > 0 ? `${draftChanges} değişiklik` : "Canlı ile aynı"}
              </span>
            </div>
            {eligibility.blockingCount > 0 && (
              <span className="text-amber-800">
                {eligibility.blockingCount} yayın engeli
              </span>
            )}
            {eligibility.emptyCount > 0 && (
              <span className="text-zinc-500">{eligibility.emptyCount} boş slot</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Canlı siteyi aç
            </a>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setPreviewOpen(true)}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50"
            >
              Önizle
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setPublishOpen(true)}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Yayınla
            </button>
          </div>
        </div>
        {saveState.kind === "error" && (
          <p className="mt-2 text-xs text-red-700" role="alert">{saveState.message}</p>
        )}
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside
          className={`border-b border-zinc-200 bg-white lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r ${
            poolOpen ? "block" : "hidden lg:block"
          }`}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2 lg:hidden">
            <span className="text-xs font-medium text-zinc-600">İçerik havuzu</span>
            <button
              type="button"
              onClick={() => setPoolOpen(false)}
              className="text-xs text-zinc-500"
            >
              Kapat
            </button>
          </div>
          <div className="h-[320px] lg:h-[calc(100vh-12rem)]">
            <HomepageBuilderContentPool
              builder={builder}
              categoryOptions={categoryOptions}
              selectedContentId={selectedContentId}
              assignTargetSlotKey={assignTargetSlotKey}
              onSelectContent={handleSelectContent}
              disabled={isBusy}
            />
          </div>
        </aside>

        <section className="flex-1 bg-zinc-50 px-4 py-4 lg:px-6">
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <button
              type="button"
              onClick={() => setPoolOpen(true)}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
            >
              İçerik havuzu
            </button>
          </div>
          <HomepageBuilderComposition
            builder={builder}
            selectedSlotKey={selectedSlotKey}
            pendingSlotKey={pendingSlotKey}
            videoPickerOpen={videoPickerOpen}
            videoPending={videoPending}
            onSelectSlot={handleSelectSlot}
            onClearSlot={handleClearSlot}
            onMoveFeatured={handleMoveFeatured}
            onSelectVideo={() => setVideoPickerOpen(true)}
            onClearVideo={() => void mutateVideo(null)}
            disabled={isBusy}
          />
        </section>

        <aside className="w-full border-t border-zinc-200 bg-white lg:w-72 lg:shrink-0 lg:border-t-0 lg:border-l">
          <div className="h-[280px] lg:h-[calc(100vh-12rem)]">
            <HomepageBuilderInspector
              builder={builder}
              selectedSlotKey={selectedSlotKey}
              onAssignToSlot={() => {
                setPoolOpen(true);
                if (selectedSlotKey) {
                  setAssignTargetSlotKey(selectedSlotKey);
                }
              }}
              onClearSlot={handleClearSlot}
              disabled={isBusy}
            />
          </div>
        </aside>
      </div>

      <HomepagePublishDialog
        open={publishOpen}
        builder={builder}
        pending={publishPending}
        onClose={() => setPublishOpen(false)}
        onConfirm={handlePublish}
      />
      <HomepagePreviewDialog
        open={previewOpen}
        builder={builder}
        onClose={() => setPreviewOpen(false)}
      />
      <HomepageVideoPicker
        open={videoPickerOpen}
        disabled={isBusy}
        onClose={() => setVideoPickerOpen(false)}
        onConfirm={(item) => {
          void mutateVideo(item.id).then((ok) => {
            if (ok) {
              setVideoPickerOpen(false);
            }
          });
        }}
      />
    </div>
  );
}
