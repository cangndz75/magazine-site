"use client";

import type { MediaRightsWriteInput } from "@magazine/domain";
import { MEDIA_RIGHTS_TEXT_MAX } from "@magazine/domain";
import {
  LICENSE_TYPE_LABELS,
  SOURCE_KIND_LABELS,
  USAGE_RESTRICTION_LABELS,
  RIGHTS_FORM_OPTIONS,
  INELIGIBILITY_REASON_LABELS,
  formatByteSize,
  formatDimensions,
  formatMediaTimestamp,
  LICENSE_EXPIRY_SIGNAL_LABELS,
  MEDIA_TYPE_LABELS,
  presentLicenseExpirySignal,
  presentMediaUsageRoleLabel,
  presentPublicEligibilityBlockedLabel,
  presentPublicationStatusLabel,
  presentWorkflowStatusLabel,
  RENDITION_VARIANT_LABELS,
} from "@/lib/media/presentation";
import { MediaRightsStatusBadge } from "./media-rights-status-badge";

export type InspectorData = {
  id: string;
  label: string;
  mediaType: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  previewUrl: string | null;
  createdAt: string;
  rights: {
    sourceKind: string;
    sourceName: string | null;
    creatorName: string | null;
    rightsHolder: string | null;
    licenseType: string;
    licenseReference: string | null;
    licenseNote: string | null;
    licenseStartsAt: string | null;
    licenseExpiresAt: string | null;
    creditLine: string | null;
    usageRestriction: string;
    territoryRestriction: string | null;
  };
  eligibility: {
    eligible: boolean;
    status: import("@magazine/domain").MediaRightsStatus;
    reasons: import("@magazine/domain").MediaPublicIneligibilityReason[];
  };
  usages: Array<{
    contentItemId: string;
    contentVersionId: string;
    title: string;
    slug: string;
    role: string;
    publicationStatus: string;
    workflowStatus: string;
    versionNumber: number;
    altText: string | null;
    credit: string | null;
  }>;
  usageCount: number;
  renditions: Array<{ variant: string; width: number; height: number }>;
};

type MediaInspectorProps = {
  data: InspectorData | null;
  loading: boolean;
  error: string | null;
  canEdit: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
  onSaveRights: (rights: MediaRightsWriteInput) => void;
  onClose?: () => void;
};

export function MediaInspectorPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-zinc-900">Varlık inceleyici</p>
      <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-500">
        Önizleme, haklar ve kullanım bilgisi için listeden bir medya seçin.
      </p>
    </div>
  );
}

function toDateInput(value: string | null): string {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
}

function fromDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return `${trimmed}T00:00:00.000Z`;
}

export function MediaInspector({
  data,
  loading,
  error,
  canEdit,
  saveState,
  saveError,
  onSaveRights,
  onClose,
}: MediaInspectorProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-zinc-500">
        Medya detayı yükleniyor…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-rose-700" role="alert">
        {error}
      </div>
    );
  }

  if (!data) {
    return <MediaInspectorPlaceholder />;
  }

  const dimensions = formatDimensions(data.width, data.height);
  const expirySignal = presentLicenseExpirySignal(data.rights.licenseExpiresAt);
  const blockedLabel = presentPublicEligibilityBlockedLabel(data.eligibility.eligible);
  const representativeAlt =
    data.usages.find((usage) => usage.altText?.trim())?.altText ?? null;
  const representativeCredit =
    data.usages.find((usage) => usage.credit?.trim())?.credit ?? null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    onSaveRights({
      sourceKind: String(formData.get("sourceKind") ?? "UNKNOWN"),
      sourceName: String(formData.get("sourceName") ?? "").trim() || null,
      creatorName: String(formData.get("creatorName") ?? "").trim() || null,
      rightsHolder: String(formData.get("rightsHolder") ?? "").trim() || null,
      licenseType: String(formData.get("licenseType") ?? "UNKNOWN"),
      licenseReference:
        String(formData.get("licenseReference") ?? "").trim() || null,
      licenseNote: String(formData.get("licenseNote") ?? "").trim() || null,
      licenseStartsAt: fromDateInput(String(formData.get("licenseStartsAt") ?? "")),
      licenseExpiresAt: fromDateInput(String(formData.get("licenseExpiresAt") ?? "")),
      creditLine: String(formData.get("creditLine") ?? "").trim() || null,
      usageRestriction: String(formData.get("usageRestriction") ?? "NONE"),
      territoryRestriction:
        String(formData.get("territoryRestriction") ?? "").trim() || null,
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-zinc-950">
            {data.label}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <MediaRightsStatusBadge
              status={data.eligibility.status}
              eligible={data.eligibility.eligible}
            />
            {blockedLabel ? (
              <span className="text-xs font-medium text-zinc-600">{blockedLabel}</span>
            ) : (
              <span className="text-xs text-emerald-700">Yayına uygun</span>
            )}
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
            aria-label="İnceleyiciyi kapat"
          >
            Kapat
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {expirySignal && data.eligibility.status !== "EXPIRED" ? (
          <div
            className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
            role="status"
          >
            {LICENSE_EXPIRY_SIGNAL_LABELS[expirySignal]}
          </div>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Önizleme
          </h3>
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
            {data.previewUrl ? (
              data.mediaType === "VIDEO" ? (
                <video
                  src={data.previewUrl}
                  controls
                  className="max-h-64 w-full bg-black"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.previewUrl}
                  alt=""
                  className="max-h-64 w-full object-contain"
                />
              )
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
                Önizleme URL’si yapılandırılmadı
              </div>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-zinc-500">Tür</dt>
              <dd>
                {MEDIA_TYPE_LABELS[data.mediaType as keyof typeof MEDIA_TYPE_LABELS] ??
                  data.mediaType}
                {" · "}
                {data.mimeType}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Boyut</dt>
              <dd>{dimensions ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Dosya</dt>
              <dd>{formatByteSize(data.byteSize)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Eklenme</dt>
              <dd>{formatMediaTimestamp(data.createdAt)}</dd>
            </div>
          </dl>
        </section>

        {data.renditions.length > 0 ? (
          <section className="mt-6 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Renditionlar
            </h3>
            <ul className="space-y-1 text-sm">
              {data.renditions.map((rendition) => (
                <li
                  key={`${rendition.variant}-${rendition.width}`}
                  className="flex justify-between gap-2 rounded border border-zinc-100 bg-zinc-50 px-2 py-1.5"
                >
                  <span className="font-medium text-zinc-800">
                    {RENDITION_VARIANT_LABELS[rendition.variant] ?? rendition.variant}
                  </span>
                  <span className="tabular-nums text-zinc-500">
                    {rendition.width}×{rendition.height}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-6 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Editoryal
          </h3>
          <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
            <p className="text-zinc-500">Kamu kredisi (varlık düzeyi)</p>
            <p className="mt-1 break-words">
              {data.rights.creditLine ?? "—"}
            </p>
            {!data.rights.creditLine ? (
              <p className="mt-2 text-xs text-amber-800">
                Eksik kredi, varlığı yayına uygun olmaktan çıkarır.
              </p>
            ) : null}
            {representativeCredit ? (
              <p className="mt-3 text-xs text-zinc-500">
                Makale bağlamında kredi: {representativeCredit}
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
            <p className="text-zinc-500">Alt metin</p>
            <p className="mt-1 break-words">{representativeAlt ?? "—"}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Alt metin makale sürümüne bağlıdır; makale editöründen düzenlenir.
            </p>
          </div>
        </section>

        {!data.eligibility.eligible ? (
          <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <h3 className="font-medium">Yayın engeli</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {data.eligibility.reasons.map((reason) => (
                <li key={reason}>{INELIGIBILITY_REASON_LABELS[reason]}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-6 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Haklar
          </h3>
          <form
            key={`${data.id}-${data.eligibility.status}-${data.eligibility.eligible}`}
            className="space-y-3"
            onSubmit={handleSubmit}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-zinc-600">Kaynak türü</span>
                <select
                  name="sourceKind"
                  disabled={!canEdit}
                  defaultValue={data.rights.sourceKind}
                  className="mt-1 w-full min-w-0 rounded border border-zinc-300 px-2 py-1.5"
                >
                  {RIGHTS_FORM_OPTIONS.sourceKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {SOURCE_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600">Lisans türü</span>
                <select
                  name="licenseType"
                  disabled={!canEdit}
                  defaultValue={data.rights.licenseType}
                  className="mt-1 w-full min-w-0 rounded border border-zinc-300 px-2 py-1.5"
                >
                  {RIGHTS_FORM_OPTIONS.licenseTypes.map((type) => (
                    <option key={type} value={type}>
                      {LICENSE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-zinc-600">Kaynak adı</span>
              <input
                name="sourceName"
                disabled={!canEdit}
                defaultValue={data.rights.sourceName ?? ""}
                maxLength={MEDIA_RIGHTS_TEXT_MAX.NAME}
                className="mt-1 w-full min-w-0 rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600">Fotoğrafçı / üretici</span>
              <input
                name="creatorName"
                disabled={!canEdit}
                defaultValue={data.rights.creatorName ?? ""}
                maxLength={MEDIA_RIGHTS_TEXT_MAX.NAME}
                className="mt-1 w-full min-w-0 rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600">Hak sahibi</span>
              <input
                name="rightsHolder"
                disabled={!canEdit}
                defaultValue={data.rights.rightsHolder ?? ""}
                maxLength={MEDIA_RIGHTS_TEXT_MAX.NAME}
                className="mt-1 w-full min-w-0 rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600">Lisans referansı</span>
              <input
                name="licenseReference"
                disabled={!canEdit}
                defaultValue={data.rights.licenseReference ?? ""}
                maxLength={MEDIA_RIGHTS_TEXT_MAX.REFERENCE}
                className="mt-1 w-full min-w-0 rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-zinc-600">Lisans başlangıcı</span>
                <input
                  type="date"
                  name="licenseStartsAt"
                  disabled={!canEdit}
                  defaultValue={toDateInput(data.rights.licenseStartsAt)}
                  className="mt-1 w-full min-w-0 rounded border border-zinc-300 px-2 py-1.5"
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600">Lisans bitişi</span>
                <input
                  type="date"
                  name="licenseExpiresAt"
                  disabled={!canEdit}
                  defaultValue={toDateInput(data.rights.licenseExpiresAt)}
                  className="mt-1 w-full min-w-0 rounded border border-zinc-300 px-2 py-1.5"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-zinc-600">Kullanım kısıtı</span>
              <select
                name="usageRestriction"
                disabled={!canEdit}
                defaultValue={data.rights.usageRestriction}
                className="mt-1 w-full min-w-0 rounded border border-zinc-300 px-2 py-1.5"
              >
                {RIGHTS_FORM_OPTIONS.usageRestrictions.map((value) => (
                  <option key={value} value={value}>
                    {USAGE_RESTRICTION_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600">Bölgesel kısıt</span>
              <input
                name="territoryRestriction"
                disabled={!canEdit}
                defaultValue={data.rights.territoryRestriction ?? ""}
                maxLength={MEDIA_RIGHTS_TEXT_MAX.TERRITORY}
                className="mt-1 w-full min-w-0 rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600">Kamu kredisi</span>
              <input
                name="creditLine"
                disabled={!canEdit}
                defaultValue={data.rights.creditLine ?? ""}
                maxLength={MEDIA_RIGHTS_TEXT_MAX.CREDIT}
                className="mt-1 w-full min-w-0 rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600">İç hukuk / hukuk notu (yalnızca personel)</span>
              <textarea
                name="licenseNote"
                disabled={!canEdit}
                defaultValue={data.rights.licenseNote ?? ""}
                maxLength={MEDIA_RIGHTS_TEXT_MAX.NOTE}
                rows={4}
                className="mt-1 w-full min-w-0 rounded border border-zinc-300 px-2 py-1.5"
              />
              <span className="mt-1 block text-xs text-zinc-500">
                Bu alan kamuya açık değildir.
              </span>
            </label>
            {canEdit ? (
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={saveState === "saving"}
                  className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saveState === "saving" ? "Kaydediliyor…" : "Hakları kaydet"}
                </button>
                {saveState === "saved" ? (
                  <span className="text-sm text-emerald-700">Kaydedildi</span>
                ) : null}
                {saveState === "error" && saveError ? (
                  <span className="text-sm text-rose-700" role="alert">
                    {saveError}
                  </span>
                ) : null}
              </div>
            ) : null}
          </form>
        </section>

        <section className="mt-6 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Bu medya nerede kullanılıyor?
          </h3>
          {data.usages.length === 0 ? (
            <p className="text-sm text-zinc-500">Henüz bir içerikte kullanılmıyor.</p>
          ) : (
            <ul className="space-y-2">
              {data.usages.slice(0, 8).map((usage) => (
                <li
                  key={`${usage.contentVersionId}-${usage.role}`}
                  className="rounded border border-zinc-200 bg-zinc-50/80 p-2.5 text-sm"
                >
                  <p className="font-medium break-words text-zinc-950">{usage.title}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {presentMediaUsageRoleLabel(usage.role)}
                    {" · "}
                    {presentPublicationStatusLabel(usage.publicationStatus)}
                    {" · "}
                    {presentWorkflowStatusLabel(usage.workflowStatus)}
                  </p>
                </li>
              ))}
              {data.usages.length > 8 ? (
                <p className="text-xs text-zinc-500">
                  +{data.usages.length - 8} ek kullanım
                </p>
              ) : null}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
