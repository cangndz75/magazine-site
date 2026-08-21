"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { ENTITY_KINDS, ENTITY_STATUS } from "@magazine/domain";
import {
  applyCursorUpdate,
  applyFilterUpdates,
  hrefWithQuery,
} from "@/lib/content/filter-query";
import { formatDateTime } from "@/lib/content/format-date";
import type { EntityPageFilters } from "@/lib/entity/page-params";
import {
  entityKindLabel,
  entityStatusLabel,
} from "@/lib/entity/presentation";
import type { EntityListHttpDto } from "@/lib/entity/serialize";
import { ContentPagination } from "./content-pagination";
import { StatusBadge } from "./status-badge";

type Props = {
  items: EntityListHttpDto[];
  nextCursor: string | null;
  filters: EntityPageFilters;
};

function statusTone(status: string): "neutral" | "success" | "warning" {
  if (status === ENTITY_STATUS.ACTIVE) {
    return "success";
  }
  if (status === ENTITY_STATUS.DRAFT) {
    return "warning";
  }
  return "neutral";
}

export function EntityAdminWorkspace({ items, nextCursor, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = applyFilterUpdates(searchParams, updates);
      startTransition(() => {
        router.push(hrefWithQuery("/entities", params));
      });
    },
    [router, searchParams, startTransition],
  );

  const navigateCursor = useCallback(
    (cursor: string) => {
      const params = applyCursorUpdate(searchParams, cursor);
      startTransition(() => {
        router.push(hrefWithQuery("/entities", params));
      });
    },
    [router, searchParams, startTransition],
  );

  const firstPageHref = hrefWithQuery(
    "/entities",
    applyFilterUpdates(searchParams, {}),
  );

  const hasFilters = Boolean(
    filters.search ||
      filters.kind ||
      filters.status ||
      filters.missingPortrait,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Varlıklar</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Kişi, kuruluş ve diğer haber varlıklarını yönetin.
          </p>
        </div>
        <Link
          href="/entities/new"
          className="inline-flex h-9 items-center justify-center rounded border border-zinc-800 bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Yeni Varlık
        </Link>
      </div>

      <div
        className="mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
        aria-busy={isPending}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Ara</span>
            <input
              type="search"
              defaultValue={filters.search ?? ""}
              placeholder="Ad, takma ad veya URL"
              className="h-9 rounded border border-zinc-300 px-3 text-sm"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  updateParams({
                    q: (event.currentTarget as HTMLInputElement).value || null,
                  });
                }
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Tür</span>
            <select
              value={filters.kind ?? ""}
              onChange={(event) =>
                updateParams({ kind: event.target.value || null })
              }
              className="h-9 rounded border border-zinc-300 px-2 text-sm"
            >
              <option value="">Tümü</option>
              {ENTITY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {entityKindLabel(kind)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Durum</span>
            <select
              value={filters.status ?? ""}
              onChange={(event) =>
                updateParams({ status: event.target.value || null })
              }
              className="h-9 rounded border border-zinc-300 px-2 text-sm"
            >
              <option value="">Tümü</option>
              <option value={ENTITY_STATUS.DRAFT}>Taslak</option>
              <option value={ENTITY_STATUS.ACTIVE}>Aktif</option>
              <option value={ENTITY_STATUS.ARCHIVED}>Arşiv</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-1 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={Boolean(filters.missingPortrait)}
              onChange={(event) =>
                updateParams({
                  missingPortrait: event.target.checked ? "1" : null,
                })
              }
            />
            Portresi eksik
          </label>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => updateParams({})}
            className="self-start text-xs text-zinc-600 underline hover:text-zinc-800"
          >
            Filtreleri temizle
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Ad</th>
              <th className="px-3 py-2 font-medium">Tür</th>
              <th className="px-3 py-2 font-medium">Durum</th>
              <th className="px-3 py-2 font-medium">URL</th>
              <th className="px-3 py-2 font-medium">Güncellendi</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                  Eşleşen varlık yok.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.entityId} className="border-b border-zinc-100 last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      href={`/entities/${item.entityId}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {item.canonicalName}
                    </Link>
                    {!item.portraitMediaId ? (
                      <p className="text-xs text-amber-700">Portre yok</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">
                    {entityKindLabel(item.kind)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      label={entityStatusLabel(item.status)}
                      variant={statusTone(item.status)}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                    {item.slug}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">
                    {formatDateTime(item.updatedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ContentPagination
        nextCursor={nextCursor}
        currentCursor={filters.cursor}
        firstPageHref={firstPageHref}
        onNavigate={navigateCursor}
        isPending={isPending}
      />
    </div>
  );
}
