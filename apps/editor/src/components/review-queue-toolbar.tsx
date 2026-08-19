"use client";

import { useState, useRef } from "react";
import type { ReviewPageFilters } from "@/lib/content/review-page-params";
import type {
  AuthorLookupOption,
  CategoryLookupOption,
} from "@/lib/content/lookup-labels";
import { formatCategoryLabel } from "@/lib/content/lookup-labels";
import { AuthorFilterPicker, CategoryFilterPicker } from "./filter-pickers";

const PUBLICATION_OPTIONS = [
  { value: "", label: "Yayın: tümü" },
  { value: "NEVER_PUBLISHED", label: "Hiç yayınlanmadı" },
  { value: "PUBLISHED", label: "Yayında" },
  { value: "UNPUBLISHED", label: "Yayından kaldırıldı" },
] as const;

type Props = {
  filters: ReviewPageFilters;
  onUpdate: (updates: Record<string, string | null>) => void;
  onClearAll: () => void;
  isPending: boolean;
  hasFilters: boolean;
  categoryOptions: CategoryLookupOption[];
  authorOptions: AuthorLookupOption[];
  selectedCategory: CategoryLookupOption | null;
  selectedAuthor: AuthorLookupOption | null;
};

export function ReviewQueueToolbar({
  filters,
  onUpdate,
  onClearAll,
  isPending,
  hasFilters,
  categoryOptions,
  authorOptions,
  selectedCategory,
  selectedAuthor,
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
          onChange={(event) =>
            onUpdate({ publicationStatus: event.target.value || null })
          }
          className="h-8 rounded border border-zinc-300 bg-white px-2 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {PUBLICATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <CategoryFilterPicker
          selected={selectedCategory}
          initialOptions={categoryOptions}
          onSelect={(id) => onUpdate({ categoryId: id })}
        />
        <AuthorFilterPicker
          selected={selectedAuthor}
          initialOptions={authorOptions}
          onSelect={(id) => onUpdate({ authorId: id })}
        />
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
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
                  (option) => option.value === filters.publicationStatus,
                )?.label ?? "Yayın"
              }
              onRemove={() => onUpdate({ publicationStatus: null })}
            />
          )}
          {filters.categoryId && selectedCategory && (
            <FilterTag
              label={formatCategoryLabel(selectedCategory)}
              onRemove={() => onUpdate({ categoryId: null })}
            />
          )}
          {filters.categoryId && !selectedCategory && (
            <FilterTag
              label="Kategori"
              onRemove={() => onUpdate({ categoryId: null })}
            />
          )}
          {filters.authorId && selectedAuthor && (
            <FilterTag
              label={selectedAuthor.displayName}
              onRemove={() => onUpdate({ authorId: null })}
            />
          )}
          {filters.authorId && !selectedAuthor && (
            <FilterTag
              label="Yazar"
              onRemove={() => onUpdate({ authorId: null })}
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
      <label htmlFor="review-search" className="sr-only">
        İnceleme kuyruğunda ara
      </label>
      <input
        id="review-search"
        type="search"
        placeholder="Başlık veya slug ile ara…"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
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
