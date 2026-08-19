"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicationStatus, WorkflowStatus } from "@magazine/domain";
import { StatusBadge } from "@/components/status-badge";
import { deriveContentStatus } from "@/lib/content/status";
import { findSlotForContentItem, slotAssignmentLabel } from "@/lib/homepage/builder-utils";
import type { HomepageBuilderView } from "@/lib/homepage/builder-types";

export type ContentPoolCategoryOption = {
  id: string;
  label: string;
};

export type ContentPoolItem = {
  id: string;
  slug: string;
  publicationStatus: PublicationStatus;
  displayVersion: {
    id: string;
    workflowStatus: WorkflowStatus;
    title: string;
  };
  publishedVersionId: string | null;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: string | null;
  primaryCategory: { id: string; name: string; slug: string } | null;
};

type Props = {
  builder: HomepageBuilderView;
  categoryOptions: ContentPoolCategoryOption[];
  selectedContentId: string | null;
  assignTargetSlotKey: string | null;
  onSelectContent: (item: ContentPoolItem) => void;
  disabled?: boolean;
};

export function HomepageBuilderContentPool({
  builder,
  categoryOptions,
  selectedContentId,
  assignTargetSlotKey,
  onSelectContent,
  disabled = false,
}: Props) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [publicationStatus, setPublicationStatus] = useState("");
  const [items, setItems] = useState<ContentPoolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (search.trim()) {
        params.set("q", search.trim());
      }
      if (categoryId) {
        params.set("categoryId", categoryId);
      }
      if (publicationStatus) {
        params.set("publicationStatus", publicationStatus);
      }
      const response = await fetch(`/api/content?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const json = (await response.json()) as {
        ok?: boolean;
        data?: { items: ContentPoolItem[] };
      };
      if (!response.ok || !json.ok || !json.data) {
        throw new Error("load_failed");
      }
      setItems(json.data.items);
    } catch {
      setError("İçerik listesi yüklenemedi.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, publicationStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadItems();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadItems]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-3 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          İçerik
        </h2>
        {assignTargetSlotKey && (
          <p className="mt-1 text-xs text-zinc-600">
            Hedef:{" "}
            <span className="font-medium">
              {slotAssignmentLabel(assignTargetSlotKey as never)}
            </span>
          </p>
        )}
        <div className="mt-3 space-y-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Başlık veya slug ara…"
            disabled={disabled}
            className="w-full rounded border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            aria-label="İçerik ara"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={disabled}
              className="rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              aria-label="Kategori filtresi"
            >
              <option value="">Tüm kategoriler</option>
              {categoryOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={publicationStatus}
              onChange={(event) => setPublicationStatus(event.target.value)}
              disabled={disabled}
              className="rounded border border-zinc-300 px-2 py-1.5 text-xs text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              aria-label="Yayın durumu filtresi"
            >
              <option value="">Tüm durumlar</option>
              <option value="PUBLISHED">Yayında</option>
              <option value="NEVER_PUBLISHED">Hiç yayınlanmadı</option>
              <option value="UNPUBLISHED">Yayından kaldırıldı</option>
            </select>
          </div>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        role="listbox"
        aria-label="İçerik havuzu"
      >
        {loading && (
          <p className="px-3 py-4 text-xs text-zinc-500">Yükleniyor…</p>
        )}
        {error && <p className="px-3 py-4 text-xs text-red-700">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="px-3 py-4 text-xs text-zinc-500">Sonuç bulunamadı.</p>
        )}
        {items.map((item) => {
          const assignedSlot = findSlotForContentItem(builder.draft, item.id);
          const status = deriveContentStatus({
            publicationStatus: item.publicationStatus,
            workflowStatus: item.displayVersion.workflowStatus,
            publishedVersionId: item.publishedVersionId,
            draftVersionId: item.draftVersionId,
            scheduledVersionId: item.scheduledVersionId,
            scheduledAt: item.scheduledAt,
            displayVersionId: item.displayVersion.id,
          });
          const selected = selectedContentId === item.id;

          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onSelectContent(item)}
              className={`w-full border-b border-zinc-100 px-3 py-3 text-left transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 ${
                selected ? "bg-zinc-100" : ""
              }`}
            >
              <div className="flex gap-3">
                <div
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded bg-zinc-100 text-[10px] font-semibold uppercase text-zinc-400"
                  aria-hidden="true"
                >
                  {item.primaryCategory?.name.slice(0, 2) ?? "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {item.displayVersion.title || "Başlıksız"}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{item.slug}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {item.primaryCategory && (
                      <span className="text-[11px] text-zinc-500">
                        {item.primaryCategory.name}
                      </span>
                    )}
                    <StatusBadge
                      label={status.publicationLabel}
                      variant={status.publicationVariant}
                    />
                    {assignedSlot && (
                      <span className="text-[11px] font-medium text-zinc-600">
                        Ana sayfada: {slotAssignmentLabel(assignedSlot)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
