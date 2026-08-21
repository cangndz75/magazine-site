"use client";

import { useRef, useState } from "react";
import type { SeoPageFilters } from "@/lib/seo/page-params";
import type { CategoryLookupOption } from "@/lib/content/lookup-labels";
import { formatCategoryLabel } from "@/lib/content/lookup-labels";
import { CategoryFilterPicker } from "./filter-pickers";

type Props = {
  filters: SeoPageFilters;
  onUpdate: (updates: Record<string, string | null>) => void;
  onClearAll: () => void;
  isPending: boolean;
  hasFilters: boolean;
  categoryOptions: CategoryLookupOption[];
  selectedCategory: CategoryLookupOption | null;
};

const PRESETS: {
  id: string;
  label: string;
  updates: Record<string, string | null>;
  active: (filters: SeoPageFilters) => boolean;
}[] = [
  {
    id: "all",
    label: "Tümü",
    updates: {
      findingFilter: null,
      publicationStatus: null,
      notPublished: null,
      indexable: null,
      missingSeoTitle: null,
      missingMetaDescription: null,
      missingHero: null,
      missingHeroAlt: null,
      legalWithdrawal: null,
      discoverReadiness: null,
    },
    active: (filters) =>
      !filters.findingFilter &&
      !filters.publicationStatus &&
      !filters.notPublished &&
      filters.indexable === undefined &&
      !filters.missingSeoTitle &&
      !filters.missingMetaDescription &&
      !filters.missingHero &&
      !filters.missingHeroAlt &&
      !filters.legalWithdrawal &&
      !filters.discoverReadiness,
  },
  {
    id: "errors",
    label: "Hatalı",
    updates: { findingFilter: "ERRORS" },
    active: (filters) => filters.findingFilter === "ERRORS",
  },
  {
    id: "warnings",
    label: "Uyarılı",
    updates: { findingFilter: "WARNINGS" },
    active: (filters) => filters.findingFilter === "WARNINGS",
  },
  {
    id: "healthy",
    label: "Sağlıklı",
    updates: { findingFilter: "HEALTHY" },
    active: (filters) => filters.findingFilter === "HEALTHY",
  },
  {
    id: "published",
    label: "Yayında",
    updates: { publicationStatus: "PUBLISHED", notPublished: null },
    active: (filters) => filters.publicationStatus === "PUBLISHED",
  },
  {
    id: "unpublished",
    label: "Yayında değil",
    updates: { notPublished: "1", publicationStatus: null },
    active: (filters) => filters.notPublished,
  },
  {
    id: "indexable",
    label: "Index",
    updates: { indexable: "1" },
    active: (filters) => filters.indexable === true,
  },
  {
    id: "noindex",
    label: "Noindex",
    updates: { indexable: "0" },
    active: (filters) => filters.indexable === false,
  },
  {
    id: "missing-description",
    label: "Eksik açıklama",
    updates: { missingMetaDescription: "1" },
    active: (filters) => filters.missingMetaDescription,
  },
  {
    id: "missing-hero",
    label: "Eksik görsel",
    updates: { missingHero: "1" },
    active: (filters) => filters.missingHero,
  },
  {
    id: "missing-alt",
    label: "Eksik alt",
    updates: { missingHeroAlt: "1" },
    active: (filters) => filters.missingHeroAlt,
  },
  {
    id: "discover-ready",
    label: "Discover hazır",
    updates: { discoverReadiness: "READY" },
    active: (filters) => filters.discoverReadiness === "READY",
  },
  {
    id: "discover-attention",
    label: "Discover dikkat",
    updates: { discoverReadiness: "NEEDS_ATTENTION" },
    active: (filters) => filters.discoverReadiness === "NEEDS_ATTENTION",
  },
  {
    id: "discover-ineligible",
    label: "Discover uygun değil",
    updates: { discoverReadiness: "NOT_ELIGIBLE" },
    active: (filters) => filters.discoverReadiness === "NOT_ELIGIBLE",
  },
];

export function SeoToolbar({
  filters,
  onUpdate,
  onClearAll,
  isPending,
  hasFilters,
  categoryOptions,
  selectedCategory,
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
        <CategoryFilterPicker
          selected={selectedCategory}
          initialOptions={categoryOptions}
          onSelect={(id) => onUpdate({ categoryId: id })}
        />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="SEO filtreleri">
        {PRESETS.map((preset) => {
          const active = preset.active(filters);
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (preset.id === "all") {
                  onUpdate(preset.updates);
                  return;
                }
                const next: Record<string, string | null> = { ...preset.updates };
                if (active) {
                  for (const key of Object.keys(preset.updates)) {
                    next[key] = null;
                  }
                }
                onUpdate(next);
              }}
              className={`h-8 rounded border px-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Aktif filtreler:</span>
          {filters.search && (
            <FilterTag label={`"${filters.search}"`} onRemove={() => onUpdate({ q: null })} />
          )}
          {filters.categoryId && selectedCategory && (
            <FilterTag
              label={formatCategoryLabel(selectedCategory)}
              onRemove={() => onUpdate({ categoryId: null })}
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
    <div className="relative min-w-[200px] max-w-sm flex-1">
      <label htmlFor="seo-search" className="sr-only">
        Başlık veya slug ara
      </label>
      <input
        id="seo-search"
        type="search"
        placeholder="Başlık veya slug ile ara…"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        className="h-8 w-full rounded border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      {isPending && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2" aria-hidden>
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
