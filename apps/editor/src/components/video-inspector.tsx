"use client";

import { useId, useState, type FormEvent } from "react";
import {
  VIDEO_DURATION_SECONDS_MAX,
  VIDEO_TEXT_MAX,
  type MediaRightsStatus,
} from "@magazine/domain";
import { buildArticleHref } from "@/lib/content/content-href";
import { formatDateTime } from "@/lib/content/format-date";
import {
  PUBLICATION_STATUS_LABELS,
  WORKFLOW_STATUS_LABELS,
} from "@/lib/content/revision-presentation";
import { formatDimensions } from "@/lib/media/presentation";
import { MediaRightsStatusBadge } from "./media-rights-status-badge";
import { VideoPosterPicker } from "./video-poster-picker";
import {
  formatVideoDuration,
  presentVideoUrlError,
  videoPosterFallbackLabel,
  videoProviderLabel,
  VIDEO_POSTER_SOURCE_LABELS,
} from "@/lib/video/presentation";

export type VideoInspectorData = {
  id: string;
  provider: string;
  providerVideoId: string;
  canonicalUrl: string;
  submittedUrl: string;
  title: string;
  caption: string | null;
  description: string | null;
  durationSeconds: number | null;
  posterMediaId: string | null;
  posterSource: "EDITORIAL" | "PROVIDER" | "NONE";
  posterPreviewUrl: string | null;
  posterWidth: number | null;
  posterHeight: number | null;
  posterLabel: string | null;
  posterEligibility: {
    eligible: boolean;
    status: string;
    reasons: string[];
  } | null;
  rightsNote: string | null;
  provenance: string | null;
  createdAt: string;
  updatedAt: string;
  usages: Array<{
    contentItemId: string;
    contentVersionId: string;
    title: string;
    slug: string;
    publicationStatus: string;
    workflowStatus: string;
    versionNumber: number;
    sortOrder: number;
    isPublishedVersion: boolean;
  }>;
  usageCount: number;
};

type PendingPoster = {
  label: string;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  eligibility: {
    eligible: boolean;
    status: string;
    reasons: string[];
  };
};

type VideoInspectorProps = {
  data: VideoInspectorData | null;
  loading: boolean;
  error: string | null;
  canEdit: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
  onSave: (payload: {
    providerUrlOrId: string;
    title: string;
    caption: string | null;
    description: string | null;
    durationSeconds: number | null;
    posterMediaId: string | null;
    rightsNote: string | null;
    provenance: string | null;
    expectedUpdatedAt: string;
  }) => void;
  onClose?: () => void;
};

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function VideoInspector({
  data,
  loading,
  error,
  canEdit,
  saveState,
  saveError,
  onSave,
  onClose,
}: VideoInspectorProps) {
  const titleId = useId();
  const captionId = useId();
  const descriptionId = useId();
  const durationId = useId();
  const provenanceId = useId();
  const rightsId = useId();
  const boundStamp = data ? `${data.id}:${data.updatedAt}` : "";
  const [formStamp, setFormStamp] = useState(boundStamp);
  const [title, setTitle] = useState(data?.title ?? "");
  const [caption, setCaption] = useState(data?.caption ?? "");
  const [description, setDescription] = useState(data?.description ?? "");
  const [duration, setDuration] = useState(
    data?.durationSeconds ? String(data.durationSeconds) : "",
  );
  const [provenance, setProvenance] = useState(data?.provenance ?? "");
  const [rightsNote, setRightsNote] = useState(data?.rightsNote ?? "");
  const [posterMediaId, setPosterMediaId] = useState<string | null>(
    data?.posterMediaId ?? null,
  );
  const [pendingPoster, setPendingPoster] = useState<PendingPoster | null>(null);
  const [posterPickerOpen, setPosterPickerOpen] = useState(false);

  if (formStamp !== boundStamp) {
    setFormStamp(boundStamp);
    setTitle(data?.title ?? "");
    setCaption(data?.caption ?? "");
    setDescription(data?.description ?? "");
    setDuration(data?.durationSeconds ? String(data.durationSeconds) : "");
    setProvenance(data?.provenance ?? "");
    setRightsNote(data?.rightsNote ?? "");
    setPosterMediaId(data?.posterMediaId ?? null);
    setPendingPoster(null);
  }

  const posterDraftDirty = posterMediaId !== data?.posterMediaId;
  const displayPosterPreviewUrl = posterMediaId
    ? posterDraftDirty
      ? pendingPoster?.previewUrl ?? null
      : data?.posterPreviewUrl ?? null
    : posterDraftDirty
      ? data?.posterSource === "PROVIDER"
        ? data?.posterPreviewUrl ?? null
        : null
      : data?.posterPreviewUrl ?? null;
  const displayPosterLabel = posterMediaId
    ? posterDraftDirty
      ? pendingPoster?.label ?? null
      : data?.posterLabel ?? null
    : null;
  const displayPosterWidth = posterMediaId
    ? posterDraftDirty
      ? pendingPoster?.width ?? null
      : data?.posterWidth ?? null
    : null;
  const displayPosterHeight = posterMediaId
    ? posterDraftDirty
      ? pendingPoster?.height ?? null
      : data?.posterHeight ?? null
    : null;
  const displayPosterEligibility = posterMediaId
    ? posterDraftDirty
      ? pendingPoster?.eligibility ?? null
      : data?.posterEligibility ?? null
    : null;
  const displayPosterSource =
    posterMediaId
      ? "EDITORIAL"
      : posterDraftDirty
        ? data?.posterSource === "PROVIDER"
          ? "PROVIDER"
          : "NONE"
        : data?.posterSource ?? "NONE";

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-zinc-500">
        Video yükleniyor…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mb-3 text-sm text-zinc-600 hover:text-zinc-900"
          >
            Kapat
          </button>
        ) : null}
        <p className="text-sm text-rose-700" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-zinc-500">
        Ayrıntı için bir video seçin.
      </div>
    );
  }

  const posterSourceLabel =
    VIDEO_POSTER_SOURCE_LABELS[
      displayPosterSource as keyof typeof VIDEO_POSTER_SOURCE_LABELS
    ] ?? displayPosterSource;
  const durationValue = duration.trim().length === 0 ? null : Number.parseInt(duration, 10);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || !data) {
      return;
    }
    if (
      durationValue !== null &&
      (!Number.isInteger(durationValue) ||
        durationValue <= 0 ||
        durationValue > VIDEO_DURATION_SECONDS_MAX)
    ) {
      return;
    }
    onSave({
      providerUrlOrId: data.canonicalUrl,
      title: title.trim(),
      caption: emptyToNull(caption),
      description: emptyToNull(description),
      durationSeconds: durationValue,
      posterMediaId,
      rightsNote: emptyToNull(rightsNote),
      provenance: emptyToNull(provenance),
      expectedUpdatedAt: data.updatedAt,
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-zinc-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{data.title}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {videoProviderLabel(data.provider)}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded px-2 text-sm text-zinc-600 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            Kapat
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="overflow-hidden rounded-lg bg-zinc-100">
          {displayPosterPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayPosterPreviewUrl}
              alt=""
              className="max-h-56 w-full object-contain"
            />
          ) : (
            <p className="flex h-40 items-center justify-center px-3 text-center text-sm text-zinc-500">
              {videoPosterFallbackLabel({
                provider: data.provider,
                posterSource: displayPosterSource,
              })}
            </p>
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Poster kaynağı: {posterSourceLabel}
          {displayPosterSource === "PROVIDER"
            ? " (YouTube güvenilir küçük resim)."
            : data.provider === "VIMEO" && displayPosterSource === "NONE"
              ? " Vimeo için sağlayıcı görseli yok; editoryal görsel seçin."
              : null}
        </p>

        <dl className="mt-4 grid gap-2 text-sm">
          <div>
            <dt className="text-zinc-500">Sağlayıcı</dt>
            <dd>{videoProviderLabel(data.provider)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Sağlayıcı video kimliği</dt>
            <dd className="break-all font-mono text-xs">{data.providerVideoId}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Kanonic URL</dt>
            <dd>
              <a
                href={data.canonicalUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-zinc-800 underline"
              >
                {data.canonicalUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Süre</dt>
            <dd>{formatVideoDuration(data.durationSeconds)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Yapıştırılan bağlantı</dt>
            <dd className="break-all text-xs text-zinc-600">{data.submittedUrl}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-zinc-500">
          Oynatma bir sonraki geçişte. Bu ekranda iframe gösterilmez.
        </p>

        <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label htmlFor={titleId} className="mb-1 block text-sm font-medium">
              Başlık
            </label>
            <input
              id={titleId}
              value={title}
              disabled={!canEdit}
              maxLength={VIDEO_TEXT_MAX.TITLE}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
            />
          </div>
          <div>
            <label htmlFor={captionId} className="mb-1 block text-sm font-medium">
              Kütüphane başlığı
            </label>
            <textarea
              id={captionId}
              value={caption}
              disabled={!canEdit}
              maxLength={VIDEO_TEXT_MAX.CAPTION}
              rows={2}
              onChange={(event) => setCaption(event.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Varlık düzeyi. Haber özelindeki başlık makale editöründedir.
            </p>
          </div>
          <div>
            <label htmlFor={descriptionId} className="mb-1 block text-sm font-medium">
              Açıklama
            </label>
            <textarea
              id={descriptionId}
              value={description}
              disabled={!canEdit}
              maxLength={VIDEO_TEXT_MAX.DESCRIPTION}
              rows={3}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
            />
          </div>
          <div>
            <label htmlFor={durationId} className="mb-1 block text-sm font-medium">
              Süre (saniye)
            </label>
            <input
              id={durationId}
              type="number"
              inputMode="numeric"
              min={1}
              max={VIDEO_DURATION_SECONDS_MAX}
              step={1}
              value={duration}
              disabled={!canEdit}
              onChange={(event) => setDuration(event.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
            />
          </div>
          <div className="rounded border border-zinc-200 p-3">
            <p className="text-sm font-medium">Poster</p>
            <p className="mt-1 text-xs text-zinc-500">
              {displayPosterLabel
                ? `${displayPosterLabel}${formatDimensions(displayPosterWidth, displayPosterHeight) ? ` · ${formatDimensions(displayPosterWidth, displayPosterHeight)}` : ""}`
                : "Editoryal poster seçilmedi."}
            </p>
            {displayPosterEligibility ? (
              <div className="mt-2">
                <MediaRightsStatusBadge
                  status={displayPosterEligibility.status as MediaRightsStatus}
                  eligible={displayPosterEligibility.eligible}
                  compact
                />
              </div>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                onClick={() => setPosterPickerOpen(true)}
                className="mt-2 h-9 rounded border border-zinc-300 px-3 text-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                Poster seç
              </button>
            ) : null}
          </div>
          <div>
            <label htmlFor={provenanceId} className="mb-1 block text-sm font-medium">
              Kaynak / provenance
            </label>
            <textarea
              id={provenanceId}
              value={provenance}
              disabled={!canEdit}
              maxLength={VIDEO_TEXT_MAX.PROVENANCE}
              rows={2}
              onChange={(event) => setProvenance(event.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
            />
            <p className="mt-1 text-xs text-amber-800">
              İç kullanım. Eksik not yayını engellemez.
            </p>
          </div>
          <div>
            <label htmlFor={rightsId} className="mb-1 block text-sm font-medium">
              Hak notu
            </label>
            <textarea
              id={rightsId}
              value={rightsNote}
              disabled={!canEdit}
              maxLength={VIDEO_TEXT_MAX.RIGHTS_NOTE}
              rows={3}
              onChange={(event) => setRightsNote(event.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
            />
            <p className="mt-1 text-xs text-amber-800">
              İç kullanım. Video hak notu makale yayını için zorunlu değildir.
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={saveState === "saving"}
                className="h-9 rounded bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
              >
                {saveState === "saving" ? "Kaydediliyor…" : "Kaydet"}
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
          ) : (
            <p className="text-sm text-zinc-500">Salt okunur.</p>
          )}
        </form>

        <section className="mt-6 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Kullanıldığı içerikler
          </h3>
          {data.usages.length === 0 ? (
            <p className="text-sm text-zinc-500">Yetkiniz dahilinde kullanım yok.</p>
          ) : (
            <ul className="space-y-2">
              {data.usages.map((usage) => (
                <li
                  key={`${usage.contentVersionId}-${usage.sortOrder}`}
                  className="rounded border border-zinc-200 p-3 text-sm"
                >
                  <a
                    href={buildArticleHref({
                      contentItemId: usage.contentItemId,
                      versionId: usage.contentVersionId,
                    })}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {usage.title}
                  </a>
                  <p className="mt-1 text-xs text-zinc-500">
                    Sıra {usage.sortOrder + 1} · Sürüm {usage.versionNumber} ·{" "}
                    {WORKFLOW_STATUS_LABELS[
                      usage.workflowStatus as keyof typeof WORKFLOW_STATUS_LABELS
                    ] ?? usage.workflowStatus}
                    {" · "}
                    {PUBLICATION_STATUS_LABELS[
                      usage.publicationStatus as keyof typeof PUBLICATION_STATUS_LABELS
                    ] ?? usage.publicationStatus}
                    {usage.isPublishedVersion ? " · Yayındaki sürüm" : " · Taslak/diğer sürüm"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <p className="mt-4 text-xs text-zinc-500">
          Son güncelleme {formatDateTime(data.updatedAt)}
        </p>
      </div>
      <VideoPosterPicker
        open={posterPickerOpen}
        disabled={!canEdit}
        selectedId={posterMediaId}
        onClose={() => setPosterPickerOpen(false)}
        onConfirm={(item) => {
          setPosterMediaId(item?.id ?? null);
          setPendingPoster(
            item
              ? {
                  label: item.label,
                  previewUrl: item.previewUrl,
                  width: item.width,
                  height: item.height,
                  eligibility: item.eligibility,
                }
              : null,
          );
          setPosterPickerOpen(false);
        }}
      />
    </div>
  );
}

export { presentVideoUrlError };
