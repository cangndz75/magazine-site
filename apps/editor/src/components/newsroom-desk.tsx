"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  NEWSROOM_SORT,
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
import { NewsroomCreateActions, NewsroomToolbar } from "./newsroom-toolbar";
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
  contentKind: "ARTICLE" | "GALLERY";
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
  canReview: boolean;
  canManageStaff: boolean;
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
  canReview,
  canManageStaff,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const isXlViewport = useIsXlViewport();

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

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
      filters.authorId ||
      filters.scheduledOnly ||
      filters.sort !== NEWSROOM_SORT.UPDATED_DESC,
  );

  const clearFilters = useCallback(() => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (filters.view !== NEWSROOM_VIEW.ALL) {
        params.set("view", filters.view);
      }
      router.push(hrefWithQuery("/", params));
    });
  }, [filters.view, router, startTransition]);

  const returnTo = buildListReturnTo(searchParams.toString());
  const firstPageHref = hrefWithQuery("/", applyFilterUpdates(searchParams, {}));
  const emptyState = newsroomEmptyState(filters.view, hasFilters);
  const headerDetail = canManageStaff
    ? "Yayın akışını, ekip gündemini ve kritik içerik durumlarını tek ekrandan yönetin."
    : canReview
      ? "İnceleme bekleyen işleri, yayın hazırlığını ve içerik önceliklerini takip edin."
      : "Taslaklarınıza dönün, foto galeriler oluşturun ve yayın sürecini izleyin.";

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
    <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Editoryal çalışma alanı
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            Haber Masası
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {headerDetail}
          </p>
        </div>
        <NewsroomCreateActions canCreate={canCreate} />
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
          categoryOptions={categoryOptions}
          authorOptions={authorOptions}
          selectedCategory={selectedCategory}
          selectedAuthor={selectedAuthor}
        />
      </div>

      <div
        className={`mt-4 grid min-w-0 gap-4 ${
          selectedItem ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""
        }`}
      >
        <section className="min-w-0">
          {items.length === 0 ? (
            <div className="rounded border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-200/40">
              <div className="max-w-2xl">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded bg-zinc-950 text-xs font-semibold text-white">
                  HM
                </span>
                <p className="mt-4 text-base font-semibold text-zinc-950">
                  {emptyState.title}
                </p>
                {emptyState.detail ? (
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    {emptyState.detail}
                  </p>
                ) : null}
                {!hasFilters && canCreate ? (
                  <div className="mt-4">
                    <NewsroomCreateActions canCreate={canCreate} />
                  </div>
                ) : null}
              </div>
              <div className="mt-5 grid gap-2 text-xs text-zinc-600 sm:grid-cols-4">
                {["Taslak", "İnceleme", "Onay", "Yayın"].map((step) => (
                  <div
                    key={step}
                    className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium"
                  >
                    {step}
                  </div>
                ))}
              </div>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 text-sm font-medium text-zinc-700 underline hover:text-zinc-950"
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

        {selectedItem ? (
          <aside className="hidden min-w-0 xl:block" aria-label="İçerik özeti">
            <NewsroomInspector
              item={selectedItem}
              returnTo={returnTo}
              onClose={handleCloseInspector}
              variant="rail"
            />
          </aside>
        ) : null}
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
            aria-label="İçerik özeti"
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
