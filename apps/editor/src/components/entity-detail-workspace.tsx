"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ENTITY_KINDS,
  ENTITY_KIND,
  ENTITY_STATUS,
  type EntityKind,
} from "@magazine/domain";
import { StaffConfirmDialog } from "./staff-confirm-dialog";
import { EntityPortraitPicker } from "./entity-portrait-picker";
import {
  entityAuditEventLabel,
  entityKindLabel,
  entityStatusLabel,
  presentEntityAdminFailure,
} from "@/lib/entity/presentation";
import type {
  EntityAuditHttpDto,
  EntityDetailHttpDto,
  EntityDuplicateHttpDto,
  EntitySlugHistoryHttpDto,
} from "@/lib/entity/serialize";
import { StatusBadge } from "./status-badge";

type FormState = {
  kind: EntityKind;
  canonicalName: string;
  slug: string;
  summary: string;
  biography: string;
  portraitMediaId: string | null;
  birthDate: string;
  occupation: string;
  officialWebsiteUrl: string;
  aliases: string[];
};

type Props = {
  mode: "create" | "edit";
  initial?: EntityDetailHttpDto;
};

async function readApiData<T>(response: Response): Promise<T> {
  const body = (await response.json()) as {
    ok: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  };
  if (!response.ok || !body.ok || !body.data) {
    throw new Error(body.error?.code ?? "REQUEST_FAILED");
  }
  return body.data;
}

function toFormState(entity?: EntityDetailHttpDto): FormState {
  if (!entity) {
    return {
      kind: ENTITY_KIND.PERSON,
      canonicalName: "",
      slug: "",
      summary: "",
      biography: "",
      portraitMediaId: null,
      birthDate: "",
      occupation: "",
      officialWebsiteUrl: "",
      aliases: [],
    };
  }
  return {
    kind: entity.kind,
    canonicalName: entity.canonicalName,
    slug: entity.slug,
    summary: entity.summary ?? "",
    biography: entity.biography ?? "",
    portraitMediaId: entity.portraitMediaId,
    birthDate: entity.birthDate ?? "",
    occupation: entity.occupation ?? "",
    officialWebsiteUrl: entity.officialWebsiteUrl ?? "",
    aliases: entity.aliases.map((item) => item.display),
  };
}

export function EntityDetailWorkspace({ mode, initial }: Props) {
  const router = useRouter();
  const aliasInputId = useId();
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [token, setToken] = useState(initial?.updatedAt ?? "");
  const [aliasDraft, setAliasDraft] = useState("");
  const [slugDraft, setSlugDraft] = useState(initial?.slug ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);
  const [duplicates, setDuplicates] = useState<EntityDuplicateHttpDto[]>([]);
  const [slugHistory, setSlugHistory] = useState<EntitySlugHistoryHttpDto[]>([]);
  const [auditEvents, setAuditEvents] = useState<EntityAuditHttpDto[]>([]);
  const [confirm, setConfirm] = useState<
    "archive" | "reactivate" | "activate" | null
  >(null);

  const isPerson = form.kind === ENTITY_KIND.PERSON;
  const isActive = initial?.status === ENTITY_STATUS.ACTIVE;
  const isDraft = initial?.status === ENTITY_STATUS.DRAFT;
  const isArchived = initial?.status === ENTITY_STATUS.ARCHIVED;

  const loadDuplicates = useCallback(async () => {
    if (!form.canonicalName.trim()) {
      setDuplicates([]);
      return;
    }
    const params = new URLSearchParams({
      canonicalName: form.canonicalName.trim(),
    });
    if (form.aliases.length > 0) {
      params.set("aliases", form.aliases.join(","));
    }
    if (initial?.entityId) {
      params.set("excludeEntityId", initial.entityId);
    }
    try {
      const data = await readApiData<{ items: EntityDuplicateHttpDto[] }>(
        await fetch(`/api/entities/duplicates?${params.toString()}`, {
          headers: { Accept: "application/json" },
        }),
      );
      setDuplicates(data.items);
    } catch {
      setDuplicates([]);
    }
  }, [form.aliases, form.canonicalName, initial]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDuplicates();
    }, 400);
    return () => clearTimeout(timer);
  }, [loadDuplicates]);

  useEffect(() => {
    if (mode !== "edit" || !initial?.entityId) {
      return;
    }
    void (async () => {
      try {
        const [history, audit] = await Promise.all([
          readApiData<{ items: EntitySlugHistoryHttpDto[] }>(
            await fetch(`/api/entities/${initial.entityId}/slug-history`, {
              headers: { Accept: "application/json" },
            }),
          ),
          readApiData<{ items: EntityAuditHttpDto[] }>(
            await fetch(`/api/entities/${initial.entityId}/audit`, {
              headers: { Accept: "application/json" },
            }),
          ),
        ]);
        setSlugHistory(history.items);
        setAuditEvents(audit.items);
      } catch {
        setSlugHistory([]);
        setAuditEvents([]);
      }
    })();
  }, [initial?.entityId, mode]);

  const duplicateWarning = useMemo(
    () =>
      duplicates.length > 0 ? (
        <div
          role="status"
          className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        >
          <p>Benzer bir kişi zaten mevcut olabilir.</p>
          <ul className="mt-2 space-y-1">
            {duplicates.map((item) => (
              <li key={`${item.entityId}-${item.matchedOn}`}>
                <Link href={`/entities/${item.entityId}`} className="underline">
                  {item.canonicalName}
                </Link>{" "}
                · {entityKindLabel(item.kind)} · {entityStatusLabel(item.status)}
              </li>
            ))}
          </ul>
        </div>
      ) : null,
    [duplicates],
  );

  function presentFailure(code: string | undefined) {
    const failure = presentEntityAdminFailure(code);
    setMessage(failure.message);
    setIsConflict(failure.isConflict);
  }

  async function saveProfile() {
    setBusy(true);
    setMessage(null);
    setIsConflict(false);
    try {
      const payload = {
        expectedUpdatedAt: token,
        kind: form.kind,
        canonicalName: form.canonicalName,
        slug: form.slug,
        summary: form.summary || null,
        biography: form.biography || null,
        portraitMediaId: form.portraitMediaId,
        birthDate: isPerson ? form.birthDate || null : null,
        occupation: isPerson ? form.occupation || null : null,
        officialWebsiteUrl: form.officialWebsiteUrl || null,
        aliases: form.aliases,
      };

      if (mode === "create") {
        const created = await readApiData<EntityDetailHttpDto>(
          await fetch("/api/entities", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }),
        );
        router.push(`/entities/${created.entityId}`);
        router.refresh();
        return;
      }

      const updated = await readApiData<EntityDetailHttpDto>(
        await fetch(`/api/entities/${initial!.entityId}`, {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }),
      );
      setForm(toFormState(updated));
      setToken(updated.updatedAt);
      setSlugDraft(updated.slug);
      router.refresh();
    } catch (error) {
      presentFailure(error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function saveSlug() {
    if (!initial?.entityId) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const updated = await readApiData<EntityDetailHttpDto & { slugChange?: unknown }>(
        await fetch(`/api/entities/${initial.entityId}/slug`, {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expectedUpdatedAt: token,
            slug: slugDraft,
          }),
        }),
      );
      setForm((current) => ({ ...current, slug: updated.slug }));
      setToken(updated.updatedAt);
      router.refresh();
    } catch (error) {
      presentFailure(error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function runLifecycle(action: "activate" | "archive" | "reactivate") {
    if (!initial?.entityId) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const updated = await readApiData<EntityDetailHttpDto>(
        await fetch(`/api/entities/${initial.entityId}/${action}`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expectedUpdatedAt: token }),
        }),
      );
      setForm(toFormState(updated));
      setToken(updated.updatedAt);
      setConfirm(null);
      router.refresh();
    } catch (error) {
      presentFailure(error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  function addAlias() {
    const next = aliasDraft.trim();
    if (!next) {
      return;
    }
    if (form.aliases.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setAliasDraft("");
      return;
    }
    setForm((current) => ({ ...current, aliases: [...current.aliases, next] }));
    setAliasDraft("");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/entities" className="text-xs text-zinc-500 hover:text-zinc-700">
            ← Varlıklar
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900">
            {mode === "create" ? "Yeni Varlık" : form.canonicalName || "Varlık"}
          </h1>
          {initial ? (
            <div className="mt-2">
              <StatusBadge
                label={entityStatusLabel(initial.status)}
                variant={isActive ? "success" : isDraft ? "warning" : "neutral"}
              />
            </div>
          ) : null}
        </div>
        {mode === "edit" ? (
          <div className="flex flex-wrap gap-2">
            {isDraft ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirm("activate")}
                className="h-9 rounded border border-zinc-800 bg-zinc-900 px-3 text-sm font-medium text-white"
              >
                Etkinleştir
              </button>
            ) : null}
            {isArchived ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirm("reactivate")}
                className="h-9 rounded border border-zinc-300 px-3 text-sm"
              >
                Yeniden etkinleştir
              </button>
            ) : null}
            {!isArchived ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirm("archive")}
                className="h-9 rounded border border-red-800 px-3 text-sm text-red-800"
              >
                Arşivle
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {message ? (
        <p
          role={isConflict ? "alert" : "status"}
          className={
            isConflict
              ? "mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
              : "mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          }
        >
          {message}
        </p>
      ) : null}

      {duplicateWarning}

      <form
        className="space-y-5 rounded-lg border border-zinc-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void saveProfile();
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Tür</span>
          <select
            value={form.kind}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                kind: event.target.value as EntityKind,
              }))
            }
            className="h-9 rounded border border-zinc-300 px-2 text-sm"
          >
            {ENTITY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {entityKindLabel(kind)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Ad</span>
          <input
            required
            value={form.canonicalName}
            onChange={(event) =>
              setForm((current) => ({ ...current, canonicalName: event.target.value }))
            }
            className="h-9 rounded border border-zinc-300 px-3 text-sm"
          />
        </label>

        {mode === "create" || !isActive ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">URL</span>
            <input
              required
              value={form.slug}
              onChange={(event) =>
                setForm((current) => ({ ...current, slug: event.target.value }))
              }
              className="h-9 rounded border border-zinc-300 px-3 font-mono text-sm"
            />
          </label>
        ) : (
          <div className="space-y-2 rounded border border-zinc-200 p-3">
            <p className="text-sm font-medium text-zinc-700">URL</p>
            <p className="font-mono text-sm text-zinc-800">{form.slug}</p>
            <p className="text-xs text-amber-800">
              Profil adresi değişecek. Eski adres ileride yeni adrese yönlendirilecek.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={slugDraft}
                onChange={(event) => setSlugDraft(event.target.value)}
                className="h-9 flex-1 rounded border border-zinc-300 px-3 font-mono text-sm"
                aria-label="Yeni URL"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveSlug()}
                className="h-9 rounded border border-zinc-300 px-3 text-sm"
              >
                URL güncelle
              </button>
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Özet</span>
          <textarea
            value={form.summary}
            onChange={(event) =>
              setForm((current) => ({ ...current, summary: event.target.value }))
            }
            rows={2}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Biyografi</span>
          <textarea
            value={form.biography}
            onChange={(event) =>
              setForm((current) => ({ ...current, biography: event.target.value }))
            }
            rows={5}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        {isPerson ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Doğum tarihi</span>
              <input
                type="date"
                value={form.birthDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, birthDate: event.target.value }))
                }
                className="h-9 rounded border border-zinc-300 px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Meslek</span>
              <input
                value={form.occupation}
                onChange={(event) =>
                  setForm((current) => ({ ...current, occupation: event.target.value }))
                }
                className="h-9 rounded border border-zinc-300 px-3 text-sm"
              />
            </label>
          </div>
        ) : null}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Resmi web sitesi</span>
          <input
            type="url"
            value={form.officialWebsiteUrl}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                officialWebsiteUrl: event.target.value,
              }))
            }
            className="h-9 rounded border border-zinc-300 px-3 text-sm"
          />
        </label>

        <EntityPortraitPicker
          portraitMediaId={form.portraitMediaId}
          disabled={busy}
          onSelect={(mediaId) =>
            setForm((current) => ({ ...current, portraitMediaId: mediaId }))
          }
          onRemove={() =>
            setForm((current) => ({ ...current, portraitMediaId: null }))
          }
        />

        <div>
          <span className="text-sm font-medium text-zinc-700">Takma adlar</span>
          <ul className="mt-2 space-y-1">
            {form.aliases.map((alias) => (
              <li
                key={alias}
                className="flex items-center justify-between rounded border border-zinc-200 px-2 py-1 text-sm"
              >
                <span>{alias}</span>
                <button
                  type="button"
                  aria-label={`${alias} takma adını kaldır`}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      aliases: current.aliases.filter((item) => item !== alias),
                    }))
                  }
                  className="text-xs text-red-700"
                >
                  Kaldır
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              id={aliasInputId}
              value={aliasDraft}
              onChange={(event) => setAliasDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addAlias();
                }
              }}
              placeholder="Yeni takma ad"
              className="h-9 flex-1 rounded border border-zinc-300 px-3 text-sm"
            />
            <button
              type="button"
              onClick={addAlias}
              className="h-9 rounded border border-zinc-300 px-3 text-sm"
            >
              Ekle
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4">
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded border border-zinc-800 bg-zinc-900 px-4 text-sm font-medium text-white disabled:bg-zinc-300"
          >
            {busy ? "Kaydediliyor…" : mode === "create" ? "Oluştur" : "Kaydet"}
          </button>
        </div>
      </form>

      {mode === "edit" ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-900">URL Geçmişi</h2>
            {slugHistory.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Kayıt yok.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {slugHistory.map((item) => (
                  <li key={`${item.oldSlug}-${item.changedAt}`}>
                    <span className="font-mono">{item.oldSlug}</span>
                    <span className="ml-2 text-zinc-500">{item.changedAt}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-900">Değişiklik Geçmişi</h2>
            {auditEvents.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Kayıt yok.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {auditEvents.map((item) => (
                  <li key={`${item.eventType}-${item.occurredAt}`}>
                    <span className="font-medium">
                      {entityAuditEventLabel(item.eventType)}
                    </span>
                    {item.changeSummary ? (
                      <span className="ml-2 text-zinc-600">{item.changeSummary}</span>
                    ) : null}
                    <div className="text-xs text-zinc-500">{item.occurredAt}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      <StaffConfirmDialog
        open={confirm === "activate"}
        pending={busy}
        title="Varlığı etkinleştir"
        description="Taslak varlık yayına hazır hale gelir. Bu işlem geri alınamaz; yalnızca arşivleme ile geri çekilebilir."
        confirmLabel="Etkinleştir"
        onConfirm={() => void runLifecycle("activate")}
        onCancel={() => setConfirm(null)}
      />
      <StaffConfirmDialog
        open={confirm === "archive"}
        pending={busy}
        destructive
        title="Varlığı arşivle"
        description="Varlık artık yeni haberlerde seçilemez."
        warning="Profil ileride herkese açık olmayacak. Mevcut haber geçmişi silinmez; ilişkiler korunur."
        confirmLabel="Arşivle"
        onConfirm={() => void runLifecycle("archive")}
        onCancel={() => setConfirm(null)}
      />
      <StaffConfirmDialog
        open={confirm === "reactivate"}
        pending={busy}
        title="Varlığı yeniden etkinleştir"
        description="Arşivlenmiş varlık tekrar seçilebilir hale gelir."
        confirmLabel="Yeniden etkinleştir"
        onConfirm={() => void runLifecycle("reactivate")}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
