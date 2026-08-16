"use client";

import { useState, useRef } from "react";
import type { ContentPageFilters } from "@/lib/content/page-params";

type Props = {
  filters: ContentPageFilters;
  onUpdate: (updates: Record<string, string | null>) => void;
  onClearAll: () => void;
  isPending: boolean;
  hasFilters: boolean;
};

const PUBLICATION_OPTIONS = [
  { value: "", label: "Tümü" },
  { value: "NEVER_PUBLISHED", label: "Yayınlanmamış" },
  { value: "PUBLISHED", label: "Yayında" },
  { value: "UNPUBLISHED", label: "Kaldırıldı" },
] as const;

const WORKFLOW_OPTIONS = [
  { value: "", label: "Tümü" },
  { value: "DRAFT", label: "Taslak" },
  { value: "IN_REVIEW", label: "İncelemede" },
  { value: "APPROVED", label: "Onaylandı" },
] as const;

export function ContentToolbar({
  filters,
  onUpdate,
  onClearAll,
  isPending,
  hasFilters,
}: Props) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          key={filters.search ?? ""}
          defaultValue={filters.search ?? ""}
          onSearch={(value) => onUpdate({ q: value || null })}
          isPending={isPending}
        />

        <select
          aria-label="Yayın durumu"
          value={filters.publicationStatus ?? ""}
          onChange={(e) =>
            onUpdate({ publicationStatus: e.target.value || null })
          }
          className="h-8 rounded border border-zinc-300 bg-white px-2 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {PUBLICATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          aria-label="İş akışı durumu"
          value={filters.workflowStatus ?? ""}
          onChange={(e) =>
            onUpdate({ workflowStatus: e.target.value || null })
          }
          className="h-8 rounded border border-zinc-300 bg-white px-2 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {WORKFLOW_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label className="flex h-8 items-center gap-1.5 rounded border border-zinc-300 bg-white px-2 text-sm text-zinc-700 has-[:checked]:border-zinc-500 has-[:checked]:bg-zinc-50">
          <input
            type="checkbox"
            checked={filters.scheduledOnly}
            onChange={(e) =>
              onUpdate({ scheduledOnly: e.target.checked ? "1" : null })
            }
            className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
          />
          Zamanlanmış
        </label>
      </div>

      {hasFilters && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Aktif filtreler:</span>
          {filters.search && (
            <FilterTag
              label={`"${filters.search}"`}
              onRemove={() => onUpdate({ q: null })}
            />
          )}
          {filters.publicationStatus && (
            <FilterTag
              label={
                PUBLICATION_OPTIONS.find(
                  (o) => o.value === filters.publicationStatus,
                )?.label ?? filters.publicationStatus
              }
              onRemove={() => onUpdate({ publicationStatus: null })}
            />
          )}
          {filters.workflowStatus && (
            <FilterTag
              label={
                WORKFLOW_OPTIONS.find(
                  (o) => o.value === filters.workflowStatus,
                )?.label ?? filters.workflowStatus
              }
              onRemove={() => onUpdate({ workflowStatus: null })}
            />
          )}
          {filters.scheduledOnly && (
            <FilterTag
              label="Zamanlanmış"
              onRemove={() => onUpdate({ scheduledOnly: null })}
            />
          )}
          <button
            type="button"
            onClick={onClearAll}
            className="ml-1 text-xs text-zinc-500 underline hover:text-zinc-700"
          >
            Tümünü temizle
          </button>
        </div>
      )}
    </div>
  );
}

function SearchInput({
  defaultValue,
  onSearch,
  isPending,
}: {
  defaultValue: string;
  onSearch: (value: string) => void;
  isPending: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  function handleChange(newValue: string) {
    setValue(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(newValue);
    }, 300);
  }

  return (
    <div className="relative flex-1 min-w-[200px] max-w-sm">
      <label htmlFor="content-search" className="sr-only">
        İçerik ara
      </label>
      <input
        id="content-search"
        type="search"
        placeholder="Başlık veya slug ile ara…"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="h-8 w-full rounded border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      {isPending && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
          <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        </span>
      )}
    </div>
  );
}

function FilterTag({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${label} filtresini kaldır`}
        className="ml-0.5 rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
      >
        ×
      </button>
    </span>
  );
}
