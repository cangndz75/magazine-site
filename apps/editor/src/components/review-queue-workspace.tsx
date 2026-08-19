"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { ReviewPageFilters } from "@/lib/content/review-page-params";
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
import { ContentPagination } from "./content-pagination";
import { ContentEmptyState } from "./content-empty-state";
import { ReviewQueueToolbar } from "./review-queue-toolbar";
import { ReviewQueueList } from "./review-queue-list";

export type ReviewQueueListItem = {
  contentItemId: string;
  versionId: string;
  versionNumber: number;
  slug: string;
  title: string;
  excerpt: string | null;
  workflowStatus: "DRAFT" | "IN_REVIEW" | "APPROVED";
  publicationStatus: "NEVER_PUBLISHED" | "PUBLISHED" | "UNPUBLISHED";
  createdAt: string;
  latestSubmittedAt: string;
  reviewRound: number;
  publishedVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: string | null;
  primaryCategory: { id: string; name: string; slug: string } | null;
  authors: { id: string; displayName: string; slug: string }[];
};

type Props = {
  items: ReviewQueueListItem[];
  nextCursor: string | null;
  filters: ReviewPageFilters;
  categoryOptions: CategoryLookupOption[];
  authorOptions: AuthorLookupOption[];
  selectedCategory: CategoryLookupOption | null;
  selectedAuthor: AuthorLookupOption | null;
};

export function ReviewQueueWorkspace({
  items,
  nextCursor,
  filters,
  categoryOptions,
  authorOptions,
  selectedCategory,
  selectedAuthor,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = applyFilterUpdates(searchParams, updates);
      startTransition(() => {
        router.push(hrefWithQuery("/review", params));
      });
    },
    [router, searchParams, startTransition],
  );

  const navigateCursor = useCallback(
    (cursor: string) => {
      const params = applyCursorUpdate(searchParams, cursor);
      startTransition(() => {
        router.push(hrefWithQuery("/review", params));
      });
    },
    [router, searchParams, startTransition],
  );

  const hasFilters = Boolean(
    filters.search ||
      filters.publicationStatus ||
      filters.categoryId ||
      filters.authorId,
  );
  const returnTo = buildListReturnTo(searchParams.toString(), "/review");
  const firstPageHref = hrefWithQuery(
    "/review",
    applyFilterUpdates(searchParams, {}),
  );

  const clearAll = useCallback(() => {
    startTransition(() => {
      router.push("/review");
    });
  }, [router, startTransition]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          İnceleme kuyruğu
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          İnceleme bekleyen sürümler, gönderilme sırasına göre.
        </p>
      </div>

      <ReviewQueueToolbar
        filters={filters}
        onUpdate={updateParams}
        onClearAll={clearAll}
        isPending={isPending}
        hasFilters={hasFilters}
        categoryOptions={categoryOptions}
        authorOptions={authorOptions}
        selectedCategory={selectedCategory}
        selectedAuthor={selectedAuthor}
      />

      {items.length === 0 ? (
        <ContentEmptyState hasFilters={hasFilters} clearHref="/review" />
      ) : (
        <>
          <ReviewQueueList
            items={items}
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
    </div>
  );
}
