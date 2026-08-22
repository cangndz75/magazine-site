"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  FEATURE_CONTROL_ERROR,
  FEATURE_CONTROL_TYPE,
  type FeatureControlKey,
} from "@magazine/domain";
import { formatDateTime } from "@/lib/content/format-date";
import {
  auditStateLabel,
  FEATURE_FLAG_EXPLANATION,
  FEATURE_FLAG_KEYS,
  featureControlLabel,
  featureFlagConfirmMessage,
  featureFlagStateLabel,
  killSwitchConfirmMessage,
  killSwitchStateLabel,
  KILL_SWITCH_IMPACT,
  KILL_SWITCH_KEYS,
} from "@/lib/feature-controls/presentation";
import type {
  FeatureControlAuditHttpDto,
  FeatureControlHttpDto,
} from "@/lib/feature-controls/serialize";
import { StatusBadge } from "@/components/status-badge";

const CARD =
  "rounded-lg border border-zinc-200 bg-white shadow-[0_1px_0_rgba(24,24,27,0.03)]";

type ConfirmTarget = {
  key: FeatureControlKey;
  enabled: boolean;
  type: FeatureControlHttpDto["type"];
};

type Props = {
  controls: FeatureControlHttpDto[];
  audit: FeatureControlAuditHttpDto[];
  loadError: boolean;
};

function FeatureFlagSwitch({
  control,
  disabled,
  onRequestChange,
}: {
  control: FeatureControlHttpDto;
  disabled: boolean;
  onRequestChange: (key: FeatureControlKey, enabled: boolean) => void;
}) {
  const explanation = FEATURE_FLAG_EXPLANATION[control.key as typeof FEATURE_FLAG_KEYS[number]];

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-100 py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-950">
            {featureControlLabel(control.key)}
          </h3>
          <StatusBadge
            label={featureFlagStateLabel(control.enabled)}
            variant={control.enabled ? "success" : "neutral"}
          />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-zinc-600">{explanation}</p>
        <p className="mt-2 text-[11px] text-zinc-500">
          <span className="font-medium text-zinc-600">Teknik anahtar:</span> {control.key}
        </p>
        {control.updatedAt ? (
          <p className="mt-1 text-[11px] text-zinc-500">
            Son güncelleme: {formatDateTime(control.updatedAt)}
            {control.updatedByDisplayName
              ? ` · ${control.updatedByDisplayName}`
              : null}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={control.enabled}
          aria-label={`${featureControlLabel(control.key)} ${featureFlagStateLabel(control.enabled)}`}
          disabled={disabled}
          onClick={() => onRequestChange(control.key, !control.enabled)}
          className={`relative h-7 w-11 rounded-full border transition-colors disabled:opacity-50 ${
            control.enabled
              ? "border-[var(--brand-magenta)] bg-[var(--brand-magenta)]"
              : "border-zinc-300 bg-zinc-200"
          }`}
        >
          <span
            className={`absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-transform ${
              control.enabled ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function KillSwitchRow({
  control,
  disabled,
  onRequestChange,
}: {
  control: FeatureControlHttpDto;
  disabled: boolean;
  onRequestChange: (key: FeatureControlKey, enabled: boolean) => void;
}) {
  const impact =
    KILL_SWITCH_IMPACT[control.key as typeof KILL_SWITCH_KEYS[number]];
  const active = control.enabled;

  return (
    <div
      className={`flex flex-col gap-3 border-t py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between ${
        active ? "border-rose-200 bg-rose-50/40 -mx-3 px-3 rounded-md" : "border-zinc-100"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-950">
            {featureControlLabel(control.key)}
          </h3>
          <StatusBadge
            label={killSwitchStateLabel(active)}
            variant={active ? "danger" : "success"}
          />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-zinc-600">{impact}</p>
        {control.updatedAt ? (
          <p className="mt-2 text-[11px] text-zinc-500">
            Son değişiklik: {formatDateTime(control.updatedAt)}
            {control.updatedByDisplayName
              ? ` · ${control.updatedByDisplayName}`
              : null}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onRequestChange(control.key, !active)}
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
            active
              ? "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
              : "border-rose-300 bg-rose-600 text-white hover:bg-rose-700"
          }`}
        >
          {active ? "Normale döndür" : "Acil durdurmayı etkinleştir"}
        </button>
      </div>
    </div>
  );
}

function ConfirmPanel({
  target,
  pending,
  onCancel,
  onConfirm,
}: {
  target: ConfirmTarget;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isKillSwitch = target.type === FEATURE_CONTROL_TYPE.KILL_SWITCH;
  const message = isKillSwitch
    ? killSwitchConfirmMessage(target.key, target.enabled)
    : featureFlagConfirmMessage(target.key, target.enabled);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feature-control-confirm-title"
    >
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
        <h2
          id="feature-control-confirm-title"
          className="text-sm font-semibold text-zinc-950"
        >
          {isKillSwitch ? "Acil durum onayı" : "Değişikliği onaylayın"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{message}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
              isKillSwitch && target.enabled
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-[var(--brand-magenta)] hover:bg-[var(--brand-magenta-hover)]"
            }`}
          >
            {pending ? "Uygulanıyor…" : "Onayla ve uygula"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FeatureControlsWorkspace({ controls, audit, loadError }: Props) {
  const router = useRouter();
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const featureFlags = controls.filter(
    (control) => control.type === FEATURE_CONTROL_TYPE.FEATURE_FLAG,
  );
  const killSwitches = controls.filter(
    (control) => control.type === FEATURE_CONTROL_TYPE.KILL_SWITCH,
  );

  const activeKillSwitches = useMemo(
    () => killSwitches.filter((control) => control.enabled),
    [killSwitches],
  );

  const requestChange = useCallback((key: FeatureControlKey, enabled: boolean) => {
    const control = controls.find((item) => item.key === key);
    if (!control) {
      return;
    }
    setActionError(null);
    setConflictMessage(null);
    setConfirmTarget({ key, enabled, type: control.type });
  }, [controls]);

  const applyChange = useCallback(async () => {
    if (!confirmTarget) {
      return;
    }
    const control = controls.find((item) => item.key === confirmTarget.key);
    if (!control?.updatedAt) {
      setActionError("Kontrol durumu şu anda doğrulanamıyor.");
      setConfirmTarget(null);
      return;
    }

    setPending(true);
    setActionError(null);
    setConflictMessage(null);

    try {
      const response = await fetch(`/api/feature-controls/${confirmTarget.key}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: confirmTarget.enabled,
          expectedUpdatedAt: control.updatedAt,
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: { code?: string; message?: string };
      };

      if (!body.ok) {
        if (body.error?.code === FEATURE_CONTROL_ERROR.WRITE_CONFLICT) {
          setConflictMessage(
            "Bu kontrol başka bir yönetici tarafından değiştirildi. Güncel durumu yeniden yükleyin.",
          );
          setConfirmTarget(null);
          return;
        }
        setActionError(
          body.error?.message ?? "Kontrol güncellenemedi.",
        );
        setConfirmTarget(null);
        return;
      }

      setConfirmTarget(null);
      router.refresh();
    } catch {
      setActionError("Kontrol güncellenemedi.");
      setConfirmTarget(null);
    } finally {
      setPending(false);
    }
  }, [confirmTarget, controls, router]);

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-4">
        <header className="border-b border-zinc-200 pb-4">
          <h1 className="text-2xl font-semibold text-zinc-950 sm:text-3xl">
            Özellik Kontrolleri
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Kontrol durumu şu anda doğrulanamıyor.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4">
      <header className="space-y-3 border-b border-zinc-200 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Operasyon
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
            Özellik Kontrolleri
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Ürün özelliklerini yönetin ve acil durum operasyon kontrollerini güvenli
            biçimde devreye alın.
          </p>
        </div>
      </header>

      {activeKillSwitches.length > 0 ? (
        <div
          className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-950"
          role="alert"
        >
          <p className="font-semibold">Acil durum kontrolleri aktif.</p>
          <p className="mt-1 leading-relaxed">
            {activeKillSwitches.length} acil durum kontrolü devrede:{" "}
            {activeKillSwitches.map((control) => featureControlLabel(control.key)).join(", ")}
          </p>
        </div>
      ) : null}

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
            }}
            className="mt-2 text-xs font-semibold text-[var(--brand-magenta)] hover:text-[var(--brand-magenta-hover)]"
          >
            Yeniden yükle
          </button>
        </div>
      ) : null}

      {actionError ? (
        <p className="text-sm text-rose-800" role="alert">{actionError}</p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-12">
        <section className={`${CARD} lg:col-span-6`}>
          <div className="border-b border-zinc-100 px-3 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Özellik Bayrakları
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Ürün yüzeylerini açın veya kapatın.
            </p>
          </div>
          <div className="px-3 py-3">
            {featureFlags.map((control) => (
              <FeatureFlagSwitch
                key={control.key}
                control={control}
                disabled={pending}
                onRequestChange={requestChange}
              />
            ))}
          </div>
        </section>

        <section className={`${CARD} lg:col-span-6`}>
          <div className="border-b border-zinc-100 px-3 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Acil Durum Kontrolleri
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Yüksek riskli operasyon müdahaleleri — tercih anahtarı değildir.
            </p>
          </div>
          <div className="px-3 py-3">
            {killSwitches.map((control) => (
              <KillSwitchRow
                key={control.key}
                control={control}
                disabled={pending}
                onRequestChange={requestChange}
              />
            ))}
          </div>
        </section>

        <section className={`${CARD} lg:col-span-12`}>
          <div className="border-b border-zinc-100 px-3 py-2.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Son Değişiklikler
            </h2>
          </div>
          <div className="px-3 py-3">
            {audit.length === 0 ? (
              <p className="text-sm text-zinc-500">Henüz kayıtlı kontrol değişikliği yok.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {audit.map((event) => (
                  <li
                    key={`${event.controlKey}-${event.occurredAt}`}
                    className="flex flex-col gap-1 py-2.5 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">
                        {featureControlLabel(event.controlKey)}
                      </p>
                      <p className="text-xs text-zinc-600">
                        {auditStateLabel(event.controlType, event.oldEnabled)} →{" "}
                        {auditStateLabel(event.controlType, event.newEnabled)}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-500 sm:text-right">
                      {formatDateTime(event.occurredAt)} · {event.actorDisplayName}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {confirmTarget ? (
        <ConfirmPanel
          target={confirmTarget}
          pending={pending}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => void applyChange()}
        />
      ) : null}
    </div>
  );
}
