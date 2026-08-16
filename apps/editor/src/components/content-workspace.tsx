"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { ContentPageFilters } from "@/lib/content/page-params";
import { ContentToolbar } from "./content-toolbar";
import { ContentList } from "./content-list";
import { ContentPagination } from "./content-pagination";
import { ContentEmptyState } from "./content-empty-state";

export type ContentListItem = {
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
};

type Props = {
  items: ContentListItem[];
  nextCursor: string | null;
  filters: ContentPageFilters;
  sessionDisplayName: string;
};

export function ContentWorkspace({ items, nextCursor, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      params.delete("cursor");

      startTransition(() => {
        const qs = params.toString();
        router.push(qs ? `/?${qs}` : "/");
      });
    },
    [router, searchParams, startTransition],
  );

  const navigateCursor = useCallback(
    (cursor: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("cursor", cursor);
      startTransition(() => {
        router.push(`/?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition],
  );

  const hasFilters = Boolean(
    filters.search ||
      filters.publicationStatus ||
      filters.workflowStatus ||
      filters.categoryId ||
      filters.scheduledOnly,
  );
  const returnTo = searchParams.toString() ? `/?${searchParams.toString()}` : "/";

  const clearAll = useCallback(() => {
    startTransition(() => {
      router.push("/");
    });
  }, [router, startTransition]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          İçerikler
        </h1>
      </div>

      <ContentToolbar
        filters={filters}
        onUpdate={updateParams}
        onClearAll={clearAll}
        isPending={isPending}
        hasFilters={hasFilters}
      />

      {items.length === 0 ? (
        <ContentEmptyState hasFilters={hasFilters} />
      ) : (
        <>
          <ContentList items={items} isPending={isPending} returnTo={returnTo} />
          <ContentPagination
            nextCursor={nextCursor}
            currentCursor={filters.cursor}
            onNavigate={navigateCursor}
            isPending={isPending}
          />
        </>
      )}
    </div>
  );
}
