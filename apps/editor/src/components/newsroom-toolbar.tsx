"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useTransition } from "react";
import type { ContentPageFilters } from "@/lib/content/page-params";
import type {
  AuthorLookupOption,
  CategoryLookupOption,
} from "@/lib/content/lookup-labels";
import { formatCategoryLabel } from "@/lib/content/lookup-labels";
import { buildArticleHref } from "@/lib/content/content-href";
import { NEWSROOM_SORT_OPTIONS } from "@/lib/content/newsroom-presentation";
import { AuthorFilterPicker, CategoryFilterPicker } from "./filter-pickers";

type Props = {
  filters: ContentPageFilters;
  onUpdate: (updates: Record<string, string | null>) => void;
  onClearFilters: () => void;
  isPending: boolean;
  hasFilters: boolean;
  canCreate: boolean;
  categoryOptions: CategoryLookupOption[];
  authorOptions: AuthorLookupOption[];
  selectedCategory: CategoryLookupOption | null;
  selectedAuthor: AuthorLookupOption | null;
};

const PUBLICATION_OPTIONS = [
  { value: "", label: "Yayın: tümü" },
  { value: "NEVER_PUBLISHED", label: "Hiç yayınlanmadı" },
  { value: "PUBLISHED", label: "Yayında" },
  { value: "UNPUBLISHED", label: "Yayından kaldırıldı" },
] as const;

const WORKFLOW_OPTIONS = [
  { value: "", label: "İş akışı: tümü" },
  { value: "DRAFT", label: "Taslak" },
  { value: "IN_REVIEW", label: "İncelemede" },
  { value: "APPROVED", label: "Onaylandı" },
] as const;

function generateDraftSlug(): string {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `haber-${stamp}-${random}`;
}

export function NewsroomToolbar({
  filters,
  onUpdate,
  onClearFilters,
  isPending,
  hasFilters,
  canCreate,
  categoryOptions,
  authorOptions,
  selectedCategory,
  selectedAuthor,
}: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleCreateArticle() {
    if (!canCreate || creating) {
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/content", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          title: "Başlıksız",
          slug: generateDraftSlug(),
          body: { blocks: [] },
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: { contentItemId: string };
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok || !payload.data?.contentItemId) {
        throw new Error(payload.error?.message ?? "Haber oluşturulamadı.");
      }

      startTransition(() => {
        router.push(
          buildArticleHref({ contentItemId: payload.data!.contentItemId }),
        );
      });
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Haber oluşturulamadı.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
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

        <AuthorFilterPicker
          selected={selectedAuthor}
          initialOptions={authorOptions}
          onSelect={(id) => onUpdate({ authorId: id })}
        />

        <select
          aria-label="Yayın durumu"
          value={filters.publicationStatus ?? ""}
          onChange={(event) =>
            onUpdate({ publicationStatus: event.target.value || null })
          }
          className="h-8 rounded border border-zinc-300 bg-white px-2 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {PUBLICATION_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          aria-label="İş akışı durumu"
          value={filters.workflowStatus ?? ""}
          onChange={(event) =>
            onUpdate({ workflowStatus: event.target.value || null })
          }
          className="h-8 rounded border border-zinc-300 bg-white px-2 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {WORKFLOW_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Sıralama"
          value={filters.sort}
          onChange={(event) => onUpdate({ sort: event.target.value || null })}
          className="h-8 rounded border border-zinc-300 bg-white px-2 text-sm text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        >
          {NEWSROOM_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          {hasFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="h-8 rounded border border-zinc-300 bg-white px-3 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              Filtreleri temizle
            </button>
          ) : null}
          {canCreate ? (
            <button
              type="button"
              onClick={() => void handleCreateArticle()}
              disabled={creating}
              className="inline-flex h-8 items-center rounded bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {creating ? "Oluşturuluyor…" : "Yeni Haber"}
            </button>
          ) : null}
        </div>
      </div>

      {createError ? (
        <p role="alert" className="text-sm text-red-700">
          {createError}
        </p>
      ) : null}

      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Aktif filtreler:</span>
          {filters.search ? (
            <FilterTag
              label={`"${filters.search}"`}
              onRemove={() => onUpdate({ q: null })}
            />
          ) : null}
          {filters.publicationStatus ? (
            <FilterTag
              label={
                PUBLICATION_OPTIONS.find(
                  (option) => option.value === filters.publicationStatus,
                )?.label ?? "Yayın"
              }
              onRemove={() => onUpdate({ publicationStatus: null })}
            />
          ) : null}
          {filters.workflowStatus ? (
            <FilterTag
              label={
                WORKFLOW_OPTIONS.find(
                  (option) => option.value === filters.workflowStatus,
                )?.label ?? "İş akışı"
              }
              onRemove={() => onUpdate({ workflowStatus: null })}
            />
          ) : null}
          {filters.categoryId && selectedCategory ? (
            <FilterTag
              label={formatCategoryLabel(selectedCategory)}
              onRemove={() => onUpdate({ categoryId: null })}
            />
          ) : null}
          {filters.categoryId && !selectedCategory ? (
            <FilterTag
              label="Kategori"
              onRemove={() => onUpdate({ categoryId: null })}
            />
          ) : null}
          {filters.authorId && selectedAuthor ? (
            <FilterTag
              label={selectedAuthor.displayName}
              onRemove={() => onUpdate({ authorId: null })}
            />
          ) : null}
          {filters.authorId && !selectedAuthor ? (
            <FilterTag
              label="Yazar"
              onRemove={() => onUpdate({ authorId: null })}
            />
          ) : null}
          {filters.sort !== "updated_desc" ? (
            <FilterTag
              label={
                NEWSROOM_SORT_OPTIONS.find(
                  (option) => option.value === filters.sort,
                )?.label ?? "Sıralama"
              }
              onRemove={() => onUpdate({ sort: null })}
            />
          ) : null}
        </div>
      ) : null}
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

  function handleChange(nextValue: string) {
    setValue(nextValue);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onSearch(nextValue);
    }, 300);
  }

  return (
    <div className="relative min-w-[180px] max-w-xs flex-1">
      <label htmlFor="newsroom-search" className="sr-only">
        Haber ara
      </label>
      <input
        id="newsroom-search"
        type="search"
        placeholder="Başlık veya slug…"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        className="h-8 w-full rounded border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      {isPending ? (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
          <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        </span>
      ) : null}
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
