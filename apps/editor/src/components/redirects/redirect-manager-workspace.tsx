"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { REDIRECT_ERROR } from "@magazine/domain";
import { formatDateTime } from "@/lib/content/format-date";
import {
  applyCursorUpdate,
  applyFilterUpdates,
  hrefWithQuery,
} from "@/lib/content/filter-query";
import type { RedirectPageFilters } from "@/lib/redirects/page-params";
import {
  redirectAuditEnabledLabel,
  redirectEnabledLabel,
  redirectPageHasFilters,
  redirectPreviewLabel,
  redirectStatusBadgeVariant,
  REDIRECT_ERROR_MESSAGES,
} from "@/lib/redirects/presentation";
import type {
  RedirectAuditHttpDto,
  RedirectRuleHttpDto,
} from "@/lib/redirects/serialize";
import { ContentPagination } from "@/components/content-pagination";
import { StatusBadge } from "@/components/status-badge";

const CARD =
  "rounded-lg border border-zinc-200 bg-white shadow-[0_1px_0_rgba(24,24,27,0.03)]";

type Props = {
  items: RedirectRuleHttpDto[];
  nextCursor: string | null;
  filters: RedirectPageFilters;
};

type ConfirmAction = {
  kind: "disable" | "enable";
  rule: RedirectRuleHttpDto;
};

export function RedirectManagerWorkspace({ items, nextCursor, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? null);
  const [detail, setDetail] = useState<RedirectRuleHttpDto | null>(null);
  const [audit, setAudit] = useState<RedirectAuditHttpDto[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [pending, setPending] = useState(false);

  const [createSource, setCreateSource] = useState("");
  const [createTarget, setCreateTarget] = useState("");
  const [createNote, setCreateNote] = useState("");

  const [editTarget, setEditTarget] = useState("");
  const [editNote, setEditNote] = useState("");

  const selected =
    items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setFormError(null);
    try {
      const response = await fetch(`/api/redirects/${id}`, {
        headers: { Accept: "application/json" },
      });
      const body = (await response.json()) as {
        ok?: boolean;
        data?: { rule: RedirectRuleHttpDto; audit: RedirectAuditHttpDto[] };
        error?: { code?: string; message?: string };
      };
      if (!body.ok || !body.data) {
        setFormError(body.error?.message ?? "Yönlendirme yüklenemedi.");
        return;
      }
      setDetail(body.data.rule);
      setAudit(body.data.audit);
      setEditTarget(body.data.rule.targetPath);
      setEditNote(body.data.rule.note ?? "");
    } catch {
      setFormError("Yönlendirme yüklenemedi.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected?.id) {
      return;
    }
    const id = selected.id;
    void Promise.resolve().then(() => loadDetail(id));
  }, [selected?.id, loadDetail]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = applyFilterUpdates(searchParams, updates);
      startTransition(() => {
        router.push(hrefWithQuery("/seo/redirects", params));
      });
    },
    [router, searchParams, startTransition],
  );

  const navigateCursor = useCallback(
    (cursor: string) => {
      const params = applyCursorUpdate(searchParams, cursor);
      startTransition(() => {
        router.push(hrefWithQuery("/seo/redirects", params));
      });
    },
    [router, searchParams, startTransition],
  );

  async function handleCreate() {
    setPending(true);
    setFormError(null);
    setConflictMessage(null);
    try {
      const response = await fetch("/api/redirects", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourcePath: createSource,
          targetPath: createTarget,
          note: createNote.trim() || null,
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: { code?: string; message?: string };
      };
      if (!body.ok) {
        setFormError(
          body.error?.message ??
            REDIRECT_ERROR_MESSAGES[body.error?.code ?? ""] ??
            "Yönlendirme oluşturulamadı.",
        );
        return;
      }
      setShowCreate(false);
      setCreateSource("");
      setCreateTarget("");
      setCreateNote("");
      router.refresh();
    } catch {
      setFormError("Yönlendirme oluşturulamadı.");
    } finally {
      setPending(false);
    }
  }

  async function handleUpdate(enabled?: boolean) {
    if (!detail) {
      return;
    }
    setPending(true);
    setFormError(null);
    setConflictMessage(null);
    try {
      const response = await fetch(`/api/redirects/${detail.id}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetPath: editTarget,
          note: editNote.trim() || null,
          enabled: enabled ?? detail.enabled,
          expectedUpdatedAt: detail.updatedAt,
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: { code?: string; message?: string };
      };
      if (!body.ok) {
        if (body.error?.code === REDIRECT_ERROR.WRITE_CONFLICT) {
          setConflictMessage(REDIRECT_ERROR_MESSAGES.WRITE_CONFLICT);
          setConfirmAction(null);
          return;
        }
        setFormError(
          body.error?.message ??
            REDIRECT_ERROR_MESSAGES[body.error?.code ?? ""] ??
            "Yönlendirme güncellenemedi.",
        );
        setConfirmAction(null);
        return;
      }
      setConfirmAction(null);
      router.refresh();
      await loadDetail(detail.id);
    } catch {
      setFormError("Yönlendirme güncellenemedi.");
      setConfirmAction(null);
    } finally {
      setPending(false);
    }
  }

  const hasFilters = redirectPageHasFilters(filters);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4">
      <header className="space-y-3 border-b border-zinc-200 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              SEO
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
              Yönlendirmeler
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Eski bağlantıları güvenli biçimde güncel adreslere yönlendirin ve SEO
              değerini koruyun.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              İçerik slug değişikliklerinden oluşan otomatik yönlendirmeler sistem
              tarafından ayrıca yönetilir.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/seo"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              SEO Komut Merkezi
            </Link>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded-md bg-[var(--brand-magenta)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-magenta-hover)]"
            >
              Yeni Yönlendirme
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-600">
          Yalnızca dahili yollar · Kalıcı yönlendirme · HTTP 308 · Harici URL desteklenmez
        </div>
      </header>

      {conflictMessage ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p>{conflictMessage}</p>
          <button
            type="button"
            onClick={() => {
              setConflictMessage(null);
              router.refresh();
              if (selected?.id) {
                void loadDetail(selected.id);
              }
            }}
            className="mt-2 text-xs font-semibold text-[var(--brand-magenta)]"
          >
            Yeniden yükle
          </button>
        </div>
      ) : null}

      {formError ? (
        <p className="text-sm text-rose-800" role="alert">{formError}</p>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="redirect-search">Ara</label>
          <input
            id="redirect-search"
            type="search"
            value={filters.search ?? ""}
            onChange={(event) =>
              updateParams({ search: event.target.value || null, cursor: null })
            }
            placeholder="Kaynak veya hedef ara…"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm sm:max-w-xs"
          />
          <label className="sr-only" htmlFor="redirect-enabled-filter">Durum</label>
          <select
            id="redirect-enabled-filter"
            value={filters.enabled === null ? "all" : filters.enabled ? "true" : "false"}
            onChange={(event) => {
              const value = event.target.value;
              updateParams({
                enabled: value === "all" ? null : value,
                cursor: null,
              });
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="all">Tüm durumlar</option>
            <option value="true">Yalnızca etkin</option>
            <option value="false">Yalnızca devre dışı</option>
          </select>
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => updateParams({ search: null, enabled: null, cursor: null })}
            className="text-xs font-semibold text-[var(--brand-magenta)]"
          >
            Filtreleri temizle
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <section className={`${CARD} lg:col-span-5`}>
          <div className="border-b border-zinc-100 px-3 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Kurallar
            </h2>
          </div>
          <div className="px-1 py-1">
            {items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-zinc-500">
                {hasFilters ? "Filtreye uygun yönlendirme yok." : "Henüz yönlendirme yok."}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        void loadDetail(item.id);
                      }}
                      className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 ${
                        selected?.id === item.id ? "bg-zinc-50" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900 truncate">
                          {item.sourcePath}
                        </span>
                        <StatusBadge
                          label={redirectEnabledLabel(item.enabled)}
                          variant={redirectStatusBadgeVariant(item.enabled)}
                        />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        → {item.targetPath}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {formatDateTime(item.updatedAt)}
                        {item.updatedByDisplayName
                          ? ` · ${item.updatedByDisplayName}`
                          : null}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ContentPagination
            nextCursor={nextCursor}
            currentCursor={filters.cursor ? { submittedAt: "", id: filters.cursor } : null}
            firstPageHref={hrefWithQuery(
              "/seo/redirects",
              applyFilterUpdates(searchParams, { cursor: null }),
            )}
            onNavigate={navigateCursor}
            isPending={isPending}
          />
        </section>

        <section className={`${CARD} lg:col-span-7`}>
          <div className="border-b border-zinc-100 px-3 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Detay ve düzenleme
            </h2>
          </div>
          <div className="px-3 py-3">
            {!selected ? (
              <p className="text-sm text-zinc-500">Düzenlemek için bir kural seçin.</p>
            ) : detailLoading || !detail || detail.id !== selected.id ? (
              <p className="text-sm text-zinc-500">Yükleniyor…</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Önizleme
                  </p>
                  <p className="mt-1 font-mono text-sm text-zinc-900">
                    {redirectPreviewLabel(detail.sourcePath, detail.targetPath)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">308 Kalıcı Yönlendirme</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-700" htmlFor="edit-source">
                    Kaynak URL
                  </label>
                  <input
                    id="edit-source"
                    type="text"
                    readOnly
                    value={detail.sourcePath}
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-700" htmlFor="edit-target">
                    Hedef URL
                  </label>
                  <input
                    id="edit-target"
                    type="text"
                    value={editTarget}
                    onChange={(event) => setEditTarget(event.target.value)}
                    placeholder="/yeni-haber-adresi"
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-700" htmlFor="edit-note">
                    Not (isteğe bağlı)
                  </label>
                  <textarea
                    id="edit-note"
                    value={editNote}
                    onChange={(event) => setEditNote(event.target.value)}
                    rows={2}
                    maxLength={500}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void handleUpdate()}
                    className="rounded-md bg-[var(--brand-magenta)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-magenta-hover)] disabled:opacity-50"
                  >
                    Kaydet
                  </button>
                  {detail.enabled ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        setConfirmAction({ kind: "disable", rule: detail })
                      }
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      Devre dışı bırak
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        setConfirmAction({ kind: "enable", rule: detail })
                      }
                      className="rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      Etkinleştir
                    </button>
                  )}
                </div>

                <div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Son değişiklikler
                  </h3>
                  {audit.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">Henüz denetim kaydı yok.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-zinc-100">
                      {audit.map((event) => (
                        <li
                          key={event.occurredAt}
                          className="py-2 text-xs text-zinc-600"
                        >
                          <p className="font-medium text-zinc-800">
                            {event.oldTargetPath ?? "—"} → {event.newTargetPath ?? "—"}
                          </p>
                          <p>
                            {redirectAuditEnabledLabel(event.oldEnabled)} →{" "}
                            {redirectAuditEnabledLabel(event.newEnabled)} ·{" "}
                            {formatDateTime(event.occurredAt)} · {event.actorDisplayName}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {showCreate ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="redirect-create-title"
        >
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
            <h2
              id="redirect-create-title"
              className="text-sm font-semibold text-zinc-950"
            >
              Yeni Yönlendirme
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Örnek: /eski-haber-adresi → /yeni-haber-adresi
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700" htmlFor="create-source">
                  Kaynak URL
                </label>
                <input
                  id="create-source"
                  type="text"
                  value={createSource}
                  onChange={(event) => setCreateSource(event.target.value)}
                  placeholder="/eski-haber-adresi"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700" htmlFor="create-target">
                  Hedef URL
                </label>
                <input
                  id="create-target"
                  type="text"
                  value={createTarget}
                  onChange={(event) => setCreateTarget(event.target.value)}
                  placeholder="/yeni-haber-adresi"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700" htmlFor="create-note">
                  Not (isteğe bağlı)
                </label>
                <textarea
                  id="create-note"
                  value={createNote}
                  onChange={(event) => setCreateNote(event.target.value)}
                  rows={2}
                  maxLength={500}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={pending}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={pending}
                className="rounded-md bg-[var(--brand-magenta)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {pending ? "Oluşturuluyor…" : "Oluştur"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="redirect-confirm-title"
        >
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
            <h2
              id="redirect-confirm-title"
              className="text-sm font-semibold text-zinc-950"
            >
              {confirmAction.kind === "disable"
                ? "Yönlendirmeyi devre dışı bırak"
                : "Yönlendirmeyi etkinleştir"}
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              {confirmAction.kind === "disable"
                ? `${confirmAction.rule.sourcePath} artık yönlendirilmeyecek. Geçmiş korunur.`
                : `${confirmAction.rule.sourcePath} yeniden yönlendirilecek.`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={pending}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() =>
                  void handleUpdate(confirmAction.kind === "enable")
                }
                disabled={pending}
                className="rounded-md bg-[var(--brand-magenta)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
