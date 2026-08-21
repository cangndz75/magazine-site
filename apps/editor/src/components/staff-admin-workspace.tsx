"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import {
  STAFF_ROLE,
  STAFF_SCOPE_MODE,
  STAFF_STATUS,
} from "@magazine/domain";
import {
  applyCursorUpdate,
  applyFilterUpdates,
  hrefWithQuery,
} from "@/lib/content/filter-query";
import { formatDateTime } from "@/lib/content/format-date";
import type { StaffPageFilters } from "@/lib/staff/page-params";
import {
  staffMfaStatusLabel,
  staffRoleLabel,
  staffScopeModeLabel,
  staffStatusLabel,
} from "@/lib/staff/presentation";
import type { StaffAccountListHttpDto } from "@/lib/staff/serialize";
import { ContentPagination } from "./content-pagination";
import { StatusBadge } from "./status-badge";

type Props = {
  items: StaffAccountListHttpDto[];
  nextCursor: string | null;
  filters: StaffPageFilters;
};

export function StaffAdminWorkspace({ items, nextCursor, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = applyFilterUpdates(searchParams, updates);
      startTransition(() => {
        router.push(hrefWithQuery("/staff", params));
      });
    },
    [router, searchParams, startTransition],
  );

  const navigateCursor = useCallback(
    (cursor: string) => {
      const params = applyCursorUpdate(searchParams, cursor);
      startTransition(() => {
        router.push(hrefWithQuery("/staff", params));
      });
    },
    [router, searchParams, startTransition],
  );

  const firstPageHref = hrefWithQuery(
    "/staff",
    applyFilterUpdates(searchParams, {}),
  );

  const hasFilters = Boolean(
    filters.search || filters.status || filters.role || filters.scopeMode,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Personel</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Hesap durumu, roller, kapsam ve güvenlik ayarlarını yönetin.
        </p>
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
              placeholder="Ad veya e-posta"
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
            <span className="text-xs font-medium text-zinc-600">Durum</span>
            <select
              value={filters.status ?? ""}
              onChange={(event) =>
                updateParams({ status: event.target.value || null })
              }
              className="h-9 rounded border border-zinc-300 px-2 text-sm"
            >
              <option value="">Tümü</option>
              <option value={STAFF_STATUS.ACTIVE}>Aktif</option>
              <option value={STAFF_STATUS.DISABLED}>Devre dışı</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Rol</span>
            <select
              value={filters.role ?? ""}
              onChange={(event) =>
                updateParams({ role: event.target.value || null })
              }
              className="h-9 rounded border border-zinc-300 px-2 text-sm"
            >
              <option value="">Tümü</option>
              <option value={STAFF_ROLE.SUPER_ADMIN}>Süper Admin</option>
              <option value={STAFF_ROLE.EDITOR}>Editör</option>
              <option value={STAFF_ROLE.AUTHOR}>Yazar</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Kapsam</span>
            <select
              value={filters.scopeMode ?? ""}
              onChange={(event) =>
                updateParams({ scopeMode: event.target.value || null })
              }
              className="h-9 rounded border border-zinc-300 px-2 text-sm"
            >
              <option value="">Tümü</option>
              <option value={STAFF_SCOPE_MODE.ALL}>Tüm kategoriler</option>
              <option value={STAFF_SCOPE_MODE.SELECTED}>
                Seçili kategoriler
              </option>
            </select>
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

      {items.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-600">
          Eşleşen personel kaydı bulunamadı.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2.5">Personel</th>
                <th className="hidden px-3 py-2.5 sm:table-cell">Roller</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Kapsam</th>
                <th className="px-3 py-2.5">Güvenlik</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Güncellendi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-3">
                    <Link
                      href={`/staff/${item.id}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {item.displayName}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {item.email}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1 sm:hidden">
                      {item.roles.map((role) => (
                        <StatusBadge
                          key={role}
                          label={staffRoleLabel(role)}
                          variant="neutral"
                        />
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {item.roles.map((role) => (
                        <StatusBadge
                          key={role}
                          label={staffRoleLabel(role)}
                          variant="neutral"
                        />
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 text-xs text-zinc-600 md:table-cell">
                    {item.scopeMode === STAFF_SCOPE_MODE.ALL
                      ? staffScopeModeLabel(item.scopeMode)
                      : `${item.scopedCategoryIds.length} kategori`}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge
                        label={staffStatusLabel(item.status)}
                        variant={
                          item.status === STAFF_STATUS.ACTIVE
                            ? "success"
                            : "warning"
                        }
                      />
                      <StatusBadge
                        label={staffMfaStatusLabel(item.mfa)}
                        variant={item.mfa.enrolled ? "info" : "neutral"}
                      />
                      {item.passwordResetRequired && (
                        <StatusBadge
                          label="Parola sıfırlama gerekli"
                          variant="warning"
                        />
                      )}
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 text-xs text-zinc-500 lg:table-cell">
                    {formatDateTime(item.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
