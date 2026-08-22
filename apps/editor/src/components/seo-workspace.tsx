"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { SeoPageFilters } from "@/lib/seo/page-params";
import { seoPageHasFilters } from "@/lib/seo/page-params";
import type { CategoryLookupOption } from "@/lib/content/lookup-labels";
import {
  applyCursorUpdate,
  applyFilterUpdates,
  hrefWithQuery,
} from "@/lib/content/filter-query";
import { buildListReturnTo } from "@/lib/content/content-href";
import { ContentEmptyState } from "./content-empty-state";
import { ContentPagination } from "./content-pagination";
import { SeoToolbar } from "./seo-toolbar";
import { SeoList, type SeoWorkspaceItem } from "./seo-list";
import { SeoSummaryCards, type SeoWorkspaceSummary } from "./seo-summary";

type Props = {
  items: SeoWorkspaceItem[];
  nextCursor: string | null;
  filters: SeoPageFilters;
  summary: SeoWorkspaceSummary;
  categoryOptions: CategoryLookupOption[];
  selectedCategory: CategoryLookupOption | null;
  canManageRedirects: boolean;
};

export function SeoWorkspace({
  items,
  nextCursor,
  filters,
  summary,
  categoryOptions,
  selectedCategory,
  canManageRedirects,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = applyFilterUpdates(searchParams, updates);
      startTransition(() => {
        router.push(hrefWithQuery("/seo", params));
      });
    },
    [router, searchParams, startTransition],
  );

  const navigateCursor = useCallback(
    (cursor: string) => {
      const params = applyCursorUpdate(searchParams, cursor);
      startTransition(() => {
        router.push(hrefWithQuery("/seo", params));
      });
    },
    [router, searchParams, startTransition],
  );

  const hasFilters = seoPageHasFilters(filters);
  const returnTo = buildListReturnTo(searchParams.toString(), "/seo");
  const firstPageHref = hrefWithQuery("/seo", applyFilterUpdates(searchParams, {}));

  const clearAll = useCallback(() => {
    startTransition(() => {
      router.push("/seo");
    });
  }, [router, startTransition]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">SEO</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600">
            Yayınlanmış ve taslak içeriklerin indekslenebilirliğini, meta alanlarını ve
            HERO durumunu tarayın. Kapsamınızdaki içerik dışında kayıt gösterilmez.
          </p>
        </div>
        {canManageRedirects ? (
          <Link
            href="/seo/redirects"
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Yönlendirmeler →
          </Link>
        ) : null}
      </div>

      <SeoSummaryCards summary={summary} />

      <SeoToolbar
        filters={filters}
        onUpdate={updateParams}
        onClearAll={clearAll}
        isPending={isPending}
        hasFilters={hasFilters}
        categoryOptions={categoryOptions}
        selectedCategory={selectedCategory}
      />

      {items.length === 0 ? (
        <ContentEmptyState hasFilters={hasFilters} clearHref="/seo" />
      ) : (
        <>
          <SeoList items={items} isPending={isPending} returnTo={returnTo} />
          <ContentPagination
            nextCursor={nextCursor}
            currentCursor={filters.cursor}
            firstPageHref={firstPageHref}
            onNavigate={navigateCursor}
            isPending={isPending}
          />
        </>
      )}

      <p className="mt-6 text-xs text-zinc-500">
        Özet kartları yetkinizdeki içerik içindir; yalnızca bu sayfadaki satırlar
        değildir.{" "}
        <Link href="/" className="underline hover:text-zinc-700">
          İçerik listesine dön
        </Link>
      </p>
    </div>
  );
}
