"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  NEWSROOM_VIEW,
  type ArticleReadinessSummaryDTO,
  type ListAttentionSummary,
  type NewsroomViewCounts,
} from "@magazine/domain";
import type { ContentPageFilters } from "@/lib/content/page-params";
import type {
  AuthorLookupOption,
  CategoryLookupOption,
} from "@/lib/content/lookup-labels";
import {
  applyCursorUpdate,
  applyFilterUpdates,
  hrefWithQuery,
} from "@/lib/content/filter-query";
import { buildListReturnTo } from "@/lib/content/content-href";
import { newsroomEmptyState } from "@/lib/content/newsroom-presentation";
import { ContentPagination } from "./content-pagination";
import { NewsroomInspector } from "./newsroom-inspector";
import { NewsroomTable } from "./newsroom-table";
import { NewsroomToolbar } from "./newsroom-toolbar";
import { NewsroomViewTabs } from "./newsroom-view-tabs";

const XL_MEDIA_QUERY = "(min-width: 1280px)";

function useIsXlViewport() {
  const [isXl, setIsXl] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(XL_MEDIA_QUERY);
    const sync = () => setIsXl(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  return isXl;
}

export type NewsroomListItem = {
  id: string;
  slug: string;
  publicationStatus: "NEVER_PUBLISHED" | "PUBLISHED" | "UNPUBLISHED";
  displayVersion: {
    id: string;
    versionNumber: number;
    workflowStatus: "DRAFT" | "IN_REVIEW" | "APPROVED";
    title: string;
    excerpt: string | null;
  };
  publishedVersionId: string | null;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  publicDateModified: string | null;
  primaryCategory: { id: string; name: string; slug: string } | null;
  authors: { id: string; displayName: string; slug: string }[];
  updatedAt: string;
  legalHoldAt: string | null;
  retractedAt: string | null;
  takedownAt: string | null;
  changesRequestedNote: string | null;
  entityCount: number;
  attention: ListAttentionSummary;
  readiness: ArticleReadinessSummaryDTO;
};

type Props = {
  items: NewsroomListItem[];
  nextCursor: string | null;
  filters: ContentPageFilters;
  viewCounts: NewsroomViewCounts;
  categoryOptions: CategoryLookupOption[];
  authorOptions: AuthorLookupOption[];
  selectedCategory: CategoryLookupOption | null;
  selectedAuthor: AuthorLookupOption | null;
  canCreate: boolean;
};

export function NewsroomDesk({
  items,
  nextCursor,
  filters,
  viewCounts,
  categoryOptions,
  authorOptions,
  selectedCategory,
  selectedAuthor,
  canCreate,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const isXlViewport = useIsXlViewport();

  const selectedItem =
    items.find((item) => item.id === selectedId) ?? null;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = applyFilterUpdates(searchParams, updates);
      startTransition(() => {
        router.push(hrefWithQuery("/", params));
      });
    },
    [router, searchParams, startTransition],
  );

  const navigateCursor = useCallback(
    (cursor: string) => {
      const params = applyCursorUpdate(searchParams, cursor);
      startTransition(() => {
        router.push(hrefWithQuery("/", params));
      });
    },
    [router, searchParams, startTransition],
  );

  const hasFilters = Boolean(
    filters.search ||
      filters.publicationStatus ||
      filters.workflowStatus ||
      filters.categoryId ||
      filters.authorId,
  );

  const clearFilters = useCallback(() => {
    startTransition(() => {
      router.push(hrefWithQuery("/", applyFilterUpdates(searchParams, { view: filters.view })));
    });
  }, [filters.view, router, searchParams, startTransition]);

  const returnTo = buildListReturnTo(searchParams.toString());
  const firstPageHref = hrefWithQuery("/", applyFilterUpdates(searchParams, {}));
  const emptyState = newsroomEmptyState(filters.view, hasFilters);

  function handleSelect(id: string) {
    setSelectedId(id);
    if (!isXlViewport) {
      setMobileInspectorOpen(true);
    }
  }

  function handleCloseInspector() {
    setMobileInspectorOpen(false);
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Haber Masası
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Operasyonel liste, filtreler ve hızlı özet.
          </p>
        </div>
      </div>

      <NewsroomViewTabs
        activeView={filters.view}
        counts={viewCounts}
        isPending={isPending}
        onSelect={(view) => {
          if (view === NEWSROOM_VIEW.ALL) {
            updateParams({ view: null });
            return;
          }
          updateParams({ view });
        }}
      />

      <div className="mt-4">
        <NewsroomToolbar
          filters={filters}
          onUpdate={updateParams}
          onClearFilters={clearFilters}
          isPending={isPending}
          hasFilters={hasFilters}
          canCreate={canCreate}
          categoryOptions={categoryOptions}
          authorOptions={authorOptions}
          selectedCategory={selectedCategory}
          selectedAuthor={selectedAuthor}
        />
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded border border-zinc-200 bg-white py-16 text-center">
              <p className="text-sm font-medium text-zinc-700">{emptyState.title}</p>
              {emptyState.detail ? (
                <p className="mt-1 max-w-md text-sm text-zinc-500">{emptyState.detail}</p>
              ) : null}
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 text-sm text-zinc-600 underline hover:text-zinc-800"
                >
                  Filtreleri temizle
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <NewsroomTable
                items={items}
                selectedId={selectedId}
                onSelect={handleSelect}
                isPending={isPending}
                returnTo={returnTo}
              />
              <ContentPagination
                nextCursor={nextCursor}
                currentCursor={filters.cursor}
                firstPageHref={firstPageHref}
                onNavigate={navigateCursor}
                isPending={isPending}
              />
            </>
          )}
        </section>

        <aside className="hidden min-w-0 xl:block" aria-label="Haber özeti">
          <NewsroomInspector
            item={selectedItem}
            returnTo={returnTo}
            onClose={handleCloseInspector}
            variant="rail"
          />
        </aside>
      </div>

      {!isXlViewport && mobileInspectorOpen && selectedItem ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 xl:hidden"
          role="presentation"
          onClick={handleCloseInspector}
        >
          <div
            className="absolute inset-x-0 bottom-0 top-12 max-w-full overflow-hidden rounded-t-xl bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Haber özeti"
            onClick={(event) => event.stopPropagation()}
          >
            <NewsroomInspector
              item={selectedItem}
              returnTo={returnTo}
              onClose={handleCloseInspector}
              variant="drawer"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
