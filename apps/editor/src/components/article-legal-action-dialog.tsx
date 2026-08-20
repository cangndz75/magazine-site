"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CONTENT_LEGAL_INTERNAL_NOTE_MIN,
  CONTENT_LEGAL_REASON_CATEGORIES,
  CONTENT_LEGAL_TEXT_MAX,
} from "@magazine/domain";
import {
  buildPublicNoticePreview,
  LEGAL_ACTION_FLOWS,
  LEGAL_REASON_LABELS,
  type LegalActionFlowId,
} from "@/lib/legal/presentation";

type Props = {
  open: boolean;
  flowId: LegalActionFlowId;
  pending: boolean;
  articleTitle: string;
  articleSlug: string;
  onConfirm: (input: {
    reasonCategory: string;
    internalNote: string;
    publicNote: string | null;
  }) => void;
  onCancel: () => void;
};

export function ArticleLegalActionDialog({
  open,
  flowId,
  pending,
  articleTitle,
  articleSlug,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const flow = LEGAL_ACTION_FLOWS[flowId];
  const [reasonCategory, setReasonCategory] = useState<string>(
    CONTENT_LEGAL_REASON_CATEGORIES[0],
  );
  const [internalNote, setInternalNote] = useState("");
  const [publicNote, setPublicNote] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const previewKind =
    flow.actionType === "CORRECTION"
      ? "CORRECTION"
      : flow.actionType === "CLARIFICATION"
        ? "CLARIFICATION"
        : flow.actionType === "RETRACTION"
          ? "RETRACTION"
          : null;

  const preview =
    previewKind && flow.showPublicPreview
      ? buildPublicNoticePreview({
          kind: previewKind,
          publicNote: publicNote.trim() || null,
        })
      : null;

  const internalValid =
    internalNote.trim().length >= CONTENT_LEGAL_INTERNAL_NOTE_MIN &&
    internalNote.trim().length <= CONTENT_LEGAL_TEXT_MAX.INTERNAL_NOTE;
  const publicValid =
    publicNote.trim().length === 0 ||
    publicNote.trim().length <= CONTENT_LEGAL_TEXT_MAX.PUBLIC_NOTE;
  const canSubmit = internalValid && publicValid && !pending;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          onCancel();
        }
      }}
      className="w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 text-zinc-900 shadow-lg backdrop:bg-zinc-950/40"
    >
      <h2 id={titleId} className="text-base font-semibold">
        {flow.confirmTitle}
      </h2>
      <p id={descriptionId} className="mt-2 text-sm text-zinc-700">
        {flow.consequenceSummary}
      </p>
      <dl className="mt-3 space-y-1 text-sm">
        <div>
          <dt className="font-medium text-zinc-500">Başlık</dt>
          <dd>{articleTitle}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-500">Adres (slug)</dt>
          <dd className="font-mono text-xs">{articleSlug}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Gerekçe kategorisi</span>
          <select
            value={reasonCategory}
            disabled={pending}
            onChange={(event) => setReasonCategory(event.target.value)}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            {CONTENT_LEGAL_REASON_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {LEGAL_REASON_LABELS[category]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="font-medium text-zinc-800">İç not (zorunlu)</span>
          <textarea
            value={internalNote}
            disabled={pending}
            rows={4}
            onChange={(event) => setInternalNote(event.target.value)}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Yalnızca yetkili personel görebilir."
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Kamu notu (isteğe bağlı)</span>
          <textarea
            value={publicNote}
            disabled={pending}
            rows={3}
            onChange={(event) => setPublicNote(event.target.value)}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Sitede görünecek metin."
          />
        </label>

        {preview ? (
          <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Kamu önizlemesi
            </p>
            <p className="mt-2 font-semibold text-amber-900">{preview.label}</p>
            <p className="mt-1 text-zinc-800">{preview.body}</p>
            <p className="mt-2 text-xs text-zinc-500">
              İç not kamu önizlemesinde gösterilmez.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="h-9 rounded px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
        >
          Vazgeç
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() =>
            onConfirm({
              reasonCategory,
              internalNote: internalNote.trim(),
              publicNote: publicNote.trim() || null,
            })
          }
          className={
            flow.destructive
              ? "h-9 rounded border border-red-800 px-3 text-sm font-medium text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-700 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
              : "h-9 rounded bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
          }
        >
          {pending ? "İşleniyor…" : flow.confirmTitle}
        </button>
      </div>
    </dialog>
  );
}
