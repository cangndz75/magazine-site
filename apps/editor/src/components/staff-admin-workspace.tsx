"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  CAPABILITY,
  ROLE_CAPABILITIES,
  STAFF_ROLE,
  STAFF_ROLES,
  STAFF_SCOPE_MODE,
  STAFF_STATUS,
  type Capability,
  type StaffRole,
} from "@magazine/domain";
import { Fragment } from "react";
import {
  applyCursorUpdate,
  applyFilterUpdates,
  hrefWithQuery,
} from "@/lib/content/filter-query";
import { formatDateTime } from "@/lib/content/format-date";
import type { StaffPageFilters } from "@/lib/staff/page-params";
import {
  STAFF_ROLE_IMPACT,
  staffCapabilityLabel,
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

const CAPABILITY_GROUPS: { label: string; capabilities: Capability[] }[] = [
  {
    label: "İçerik",
    capabilities: [
      CAPABILITY.CONTENT_READ,
      CAPABILITY.CONTENT_CREATE,
      CAPABILITY.CONTENT_EDIT,
      CAPABILITY.CONTENT_REVIEW,
    ],
  },
  {
    label: "Yayın ve operasyon",
    capabilities: [
      CAPABILITY.CONTENT_PUBLISH,
      CAPABILITY.HOMEPAGE_MANAGE,
      CAPABILITY.CATEGORY_MANAGE,
    ],
  },
  {
    label: "Güvenlik ve yönetim",
    capabilities: [
      CAPABILITY.CONTENT_LEGAL,
      CAPABILITY.STAFF_MANAGE,
      CAPABILITY.ANALYTICS_READ,
    ],
  },
];

export function StaffAdminWorkspace({ items, nextCursor, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedStaffId, setSelectedStaffId] = useState(items[0]?.id ?? null);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedStaffId) ?? items[0] ?? null,
    [items, selectedStaffId],
  );

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
  const summary = summarizeVisibleStaff(items);

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5">
      <header className="mb-5 flex flex-col gap-3 border-b border-zinc-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-700">
            Super Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
            Personel ve Erişim
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-600">
            Haber merkezi hesaplarını, rollerini, kategori kapsamlarını ve güvenlik
            durumlarını yönetin.
          </p>
        </div>
        <nav className="flex flex-wrap gap-1 text-sm" aria-label="Personel yönetimi bölümleri">
          <SectionLink href="#personel">Personel</SectionLink>
          <SectionLink href="#roller-yetkiler">Roller & Yetkiler</SectionLink>
          <SectionLink href="#erisim-guvenlik">Erişim / Güvenlik</SectionLink>
        </nav>
      </header>

      <section
        className="mb-4 grid border-y border-zinc-200 bg-white text-sm sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Personel özeti"
      >
        <SummaryStat label="Bu sayfada personel" value={String(items.length)} />
        <SummaryStat label="Aktif hesap" value={String(summary.active)} />
        <SummaryStat label="MFA etkin" value={String(summary.mfaEnabled)} />
        <SummaryStat label="Süper Admin" value={String(summary.superAdmin)} />
      </section>

      <section
        className="mb-4 border border-zinc-200 bg-white p-3"
        aria-busy={isPending}
        aria-label="Personel filtreleri"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-zinc-600">Ara</span>
            <input
              key={filters.search ?? ""}
              type="search"
              defaultValue={filters.search ?? ""}
              placeholder="Ad veya e-posta"
              className="h-9 rounded border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  updateParams({
                    q: (event.currentTarget as HTMLInputElement).value || null,
                  });
                }
              }}
            />
          </label>
          <FilterSelect
            label="Durum"
            value={filters.status ?? ""}
            onChange={(value) => updateParams({ status: value || null })}
            options={[
              ["", "Tümü"],
              [STAFF_STATUS.ACTIVE, "Aktif"],
              [STAFF_STATUS.DISABLED, "Devre dışı"],
            ]}
          />
          <FilterSelect
            label="Rol"
            value={filters.role ?? ""}
            onChange={(value) => updateParams({ role: value || null })}
            options={[
              ["", "Tümü"],
              [STAFF_ROLE.SUPER_ADMIN, "Süper Admin"],
              [STAFF_ROLE.EDITOR, "Editör"],
              [STAFF_ROLE.AUTHOR, "Yazar"],
            ]}
          />
          <FilterSelect
            label="Kapsam"
            value={filters.scopeMode ?? ""}
            onChange={(value) => updateParams({ scopeMode: value || null })}
            options={[
              ["", "Tümü"],
              [STAFF_SCOPE_MODE.ALL, "Tüm kategoriler"],
              [STAFF_SCOPE_MODE.SELECTED, "Seçili kategoriler"],
            ]}
          />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() =>
              updateParams({
                q: null,
                status: null,
                role: null,
                scopeMode: null,
              })
            }
            className="mt-3 text-xs font-medium text-zinc-600 underline hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            Filtreleri temizle
          </button>
        )}
      </section>

      <section id="personel" className="scroll-mt-4">
        {items.length === 0 ? (
          <p className="border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-600">
            {hasFilters
              ? "Bu filtrelerle eşleşen personel kaydı bulunamadı."
              : "Henüz personel kaydı bulunmuyor."}
          </p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <StaffTable
              items={items}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedStaffId}
            />
            <div className="space-y-4">
              {selected && <StaffInspector account={selected} />}
              <SecuritySnapshot items={items} />
            </div>
          </div>
        )}

        <ContentPagination
          nextCursor={nextCursor}
          currentCursor={filters.cursor}
          firstPageHref={firstPageHref}
          onNavigate={navigateCursor}
          isPending={isPending}
        />
      </section>

      <section id="roller-yetkiler" className="mt-8 scroll-mt-4">
        <div className="border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-950">
              Roller & Yetkiler
            </h2>
            <p className="mt-1 text-xs text-zinc-600">
              Yetkiler kod tarafındaki rol haritasından türetilir. Kategori kapsamı
              bu matristen ayrı uygulanır: Editör veya Yazar için “İçerik düzenleme”
              her kategoride erişim anlamına gelmez.
            </p>
          </div>
          <RoleCapabilityMatrix />
        </div>
      </section>
    </div>
  );
}

function StaffTable({
  items,
  selectedId,
  onSelect,
}: {
  items: StaffAccountListHttpDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <div
        className="hidden overflow-x-auto border-y border-zinc-200 bg-white md:block"
        role="region"
        aria-label="Personel listesi"
      >
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2.5">Personel</th>
              <th className="px-3 py-2.5">Rol</th>
              <th className="px-3 py-2.5">Erişim kapsamı</th>
              <th className="px-3 py-2.5">Hesap</th>
              <th className="px-3 py-2.5">MFA</th>
              <th className="px-3 py-2.5">Güncelleme</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item) => (
              <tr
                key={item.id}
                aria-selected={item.id === selectedId}
                className={
                  item.id === selectedId
                    ? "bg-fuchsia-50/70 shadow-[inset_3px_0_0_#be185d]"
                    : "hover:bg-zinc-50"
                }
              >
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className="text-left font-medium text-zinc-950 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  >
                    {item.displayName}
                  </button>
                  <p className="mt-0.5 max-w-[280px] truncate text-xs text-zinc-500">
                    {item.email}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <RoleBadges roles={item.roles} />
                </td>
                <td className="px-3 py-3 text-xs text-zinc-700">
                  {scopeSummary(item)}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge
                    label={staffStatusLabel(item.status)}
                    variant={
                      item.status === STAFF_STATUS.ACTIVE ? "success" : "warning"
                    }
                  />
                </td>
                <td className="px-3 py-3">
                  <StatusBadge
                    label={staffMfaStatusLabel(item.mfa)}
                    variant={item.mfa.enrolled ? "info" : "neutral"}
                  />
                </td>
                <td className="px-3 py-3 text-xs text-zinc-500">
                  {formatDateTime(item.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden" aria-label="Personel mobil listesi">
        {items.map((item) => (
          <article
            key={item.id}
            className="border-y border-zinc-200 bg-white px-3 py-3"
          >
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className="text-left text-sm font-semibold text-zinc-950 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              {item.displayName}
            </button>
            <p className="mt-0.5 break-all text-xs text-zinc-500">{item.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <RoleBadges roles={item.roles} />
              <StatusBadge
                label={staffStatusLabel(item.status)}
                variant={
                  item.status === STAFF_STATUS.ACTIVE ? "success" : "warning"
                }
              />
              <StatusBadge
                label={staffMfaStatusLabel(item.mfa)}
                variant={item.mfa.enrolled ? "info" : "neutral"}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-600">{scopeSummary(item)}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function StaffInspector({ account }: { account: StaffAccountListHttpDto }) {
  return (
    <aside
      className="border border-zinc-200 bg-white p-4"
      aria-label="Seçili personel özeti"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-700">
        Personel denetimi
      </p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-950">
        {account.displayName}
      </h2>
      <p className="mt-0.5 break-all text-sm text-zinc-600">{account.email}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <InspectorFact label="Hesap" value={staffStatusLabel(account.status)} />
        <InspectorFact label="MFA" value={staffMfaStatusLabel(account.mfa)} />
        <InspectorFact label="Kapsam" value={staffScopeModeLabel(account.scopeMode)} />
        <InspectorFact
          label="Kategori"
          value={
            account.scopeMode === STAFF_SCOPE_MODE.ALL
              ? "Tüm içerikler"
              : `${account.scopedCategoryIds.length} kategori`
          }
        />
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Roller
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <RoleBadges roles={account.roles} />
        </div>
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4 text-xs text-zinc-600">
        <p>
          <span className="font-medium text-zinc-900">Son güncelleme:</span>{" "}
          {formatDateTime(account.updatedAt)}
        </p>
        <p className="mt-1">
          <span className="font-medium text-zinc-900">Oluşturulma:</span>{" "}
          {formatDateTime(account.createdAt)}
        </p>
        {account.passwordResetRequired && (
          <p className="mt-2 border-l-2 border-amber-500 pl-2 text-amber-800">
            Parola sıfırlama zorunlu.
          </p>
        )}
      </div>

      <Link
        href={`/staff/${account.id}`}
        className="mt-5 inline-flex h-9 w-full items-center justify-center rounded bg-zinc-950 px-3 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500"
      >
        Düzenle
      </Link>
    </aside>
  );
}

function SecuritySnapshot({ items }: { items: StaffAccountListHttpDto[] }) {
  const disabled = items.filter((item) => item.status === STAFF_STATUS.DISABLED).length;
  const resetRequired = items.filter((item) => item.passwordResetRequired).length;

  return (
    <section
      id="erisim-guvenlik"
      className="border border-zinc-200 bg-white p-4"
      aria-label="Erişim ve güvenlik özeti"
    >
      <h2 className="text-sm font-semibold text-zinc-950">Erişim / Güvenlik</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <SnapshotRow label="Devre dışı hesap" value={String(disabled)} />
        <SnapshotRow label="Parola sıfırlama gerekli" value={String(resetRequired)} />
        <SnapshotRow
          label="MFA kurulmamış"
          value={String(items.filter((item) => !item.mfa.enrolled).length)}
        />
      </dl>
      <p className="mt-3 text-xs text-zinc-500">
        Oturum sonlandırma, MFA devre dışı bırakma ve parola sıfırlama işlemleri
        personel detayında mevcut sunucu komutlarıyla yapılır.
      </p>
    </section>
  );
}

function RoleCapabilityMatrix() {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-2.5">Yetki</th>
            {STAFF_ROLES.map((role) => (
              <th key={role} className="px-4 py-2.5">
                {staffRoleLabel(role)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CAPABILITY_GROUPS.map((group) => (
            <Fragment key={group.label}>
              <tr key={`${group.label}-heading`} className="border-y border-zinc-100 bg-zinc-50">
                <th
                  colSpan={STAFF_ROLES.length + 1}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500"
                >
                  {group.label}
                </th>
              </tr>
              {group.capabilities.map((capability) => (
                <tr key={capability} className="border-b border-zinc-100">
                  <td className="px-4 py-2.5 font-medium text-zinc-900">
                    {staffCapabilityLabel(capability)}
                  </td>
                  {STAFF_ROLES.map((role) => (
                    <td key={`${role}-${capability}`} className="px-4 py-2.5">
                      {ROLE_CAPABILITIES[role].includes(capability) ? (
                        <span className="font-semibold text-emerald-800">Var</span>
                      ) : (
                        <span className="text-zinc-400">Yok</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      <div className="grid border-t border-zinc-200 md:grid-cols-3">
        {STAFF_ROLES.map((role) => (
          <div key={role} className="border-zinc-200 px-4 py-3 text-xs md:border-r md:last:border-r-0">
            <p className="font-semibold text-zinc-900">{staffRoleLabel(role)}</p>
            <p className="mt-1 text-zinc-600">{STAFF_ROLE_IMPACT[role]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoleBadges({ roles }: { roles: readonly StaffRole[] }) {
  return (
    <>
      {roles.map((role) => (
        <StatusBadge key={role} label={staffRoleLabel(role)} variant="neutral" />
      ))}
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-[150px] rounded border border-zinc-300 px-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "all"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      className="rounded px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
    >
      {children}
    </a>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-zinc-200 px-4 py-3 sm:border-r sm:last:border-r-0 lg:border-b-0">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function InspectorFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 px-2.5 py-2">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 font-medium text-zinc-900">{value}</p>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}

function scopeSummary(item: StaffAccountListHttpDto): string {
  if (item.scopeMode === STAFF_SCOPE_MODE.ALL) {
    return "Tüm içerikler";
  }
  return `${item.scopedCategoryIds.length} seçili kategori`;
}

function summarizeVisibleStaff(items: StaffAccountListHttpDto[]) {
  return {
    active: items.filter((item) => item.status === STAFF_STATUS.ACTIVE).length,
    mfaEnabled: items.filter((item) => item.mfa.enrolled).length,
    superAdmin: items.filter((item) =>
      item.roles.includes(STAFF_ROLE.SUPER_ADMIN),
    ).length,
  };
}
